/**
 * A standalone service for authenticating JWT from auth0.
 * 
 * Uses superagent for http requests and jsonwebtoken for
 * verifying JWTs.
 * 
 * The Auth0AccessToken are any relevant claims that is to be
 * extracted from the token payload.
 * For a break down of the claims available.
 * @see https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-token-claims
 *
 * In this example the relevant client information are stored
 * as env vars.
 * 
 * Adapted from concepts and examples mentioned here:
 * https://auth0.com/blog/navigating-rs256-and-jwks/
 */
import * as request from 'superagent';
import * as jwt from 'jsonwebtoken';

export interface AUTH0_JWK {
  /** Key type */
  kty: string;
  /** unique identifier for the key. */
  kid: string;
  /** Algorithm of the key */
  alg: string;
  /** How the key is to be used. */
  use: string;
  /** x509 certification chain. */
  x5c: string[];
  /** exponent for a standard pem. */
  e: string;
  /** moduluos for a standard pem */
  n: string;
  /** thumbprint of the x.509 cert (SHA-1 thumbprint) */
  x5t: string;
}

export interface Auth0AccessToken {
  exp: number;
  sub: string;
}

export interface SigningKey {
  kid: string;
  publicKey: string;
}

export interface Auth0ClientOptions {
  /** How long to cache jwks for. */
  cacheTime?: number;
  /** Ignore token expiry date. */
  ignoreExpiration?: boolean;
}

const defaultOptions: Auth0ClientOptions = {
  cacheTime: 60000,
  ignoreExpiration: process.env.NODE_ENV === 'development',
};

/**
 * Periodically retrieve JWKs from auth0 to manually authenticate
 * JWT.
 */
export class Auth0Client {
  request: request.SuperAgentStatic;
  jwtService: typeof jwt;
  /** jwk cache. key value pair, [kid, public key] */
  JWKS: Map<string, string>;
  lastUpdatedAt: number;
  /** Elapsed time in ms before updating the JWK cache. */
  cacheTime: number;
  /** Ignore token expiry date. */
  ignoreExpiration: boolean;
  /**
   * Use for deferring concurrent calls to update the cache so that
   * only a single call to auth0 endpoint is made at a time.
   */
  deferJWKRequest: null | Promise<unknown>;
  /**
   *
   * @param agent SuperAgent instance for making http requests.
   * @param jwtService Jsonwebtoken
   * @param options
   */
  constructor(
    agent: request.SuperAgentStatic = request,
    jwtService = jwt,
    options: Auth0ClientOptions = defaultOptions,
  ) {
    this.request = agent;
    this.JWKS = new Map();
    this.lastUpdatedAt = 0;
    this.cacheTime = options?.cacheTime || 60000;
    this.ignoreExpiration =
      options?.ignoreExpiration !== undefined
        ? options.ignoreExpiration
        : false;
    this.deferJWKRequest = null;
    this.jwtService = jwtService;
  }

  /**
   * Makes a request to Auth0 to retrieve the public keys associated
   * with the domain.
   */
  private async getJwks(): Promise<AUTH0_JWK[]> {
    const res = await request
      .get(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`)
      .timeout({
        deadline: 10000
      })
      .set('Accept', 'application/json');

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new TypeError(
        (res.body && (res.body.message || res.body)) ||
          `Http Error ${res.statusCode}`,
      );
    }

    return res.body.keys;
  }

  /**
   * Get the signing key that is associated with kid.
   */
  async getSigningKey(kid: string): Promise<string> {
    // If the cache is currently being updated wait for it
    // to complete before retrieving the key.
    if (this.deferJWKRequest) {
      await this.deferJWKRequest;
    }

    // Check to see if the cache should be updated.
    await this.updateKeyCacheIfStale();

    // Return the key from the cache.
    if (this.JWKS.has(kid)) {
      return this.JWKS.get(kid);
    } else {
      throw new TypeError(`Unable to find a signing key that matches '${kid}'`);
    }
  }

  /**
   * Explicitly update the cache.
   */
  async updateKeyCache() {
    const keys = await this.getJwks();
    this.JWKS.clear();
    keys.forEach((key) => {
      if (
        key.use === 'sig' && // JWK property `use` determines the JWK is for signature verification
        key.kty === 'RSA' && // We are only supporting RSA (RS256)
        key.kid && // The `kid` must be present to be useful for later
        ((key.x5c && key.x5c.length) || (key.n && key.e)) // Has useful public keys
      ) {
        this.JWKS.set(key.kid, Auth0Client.certToPEM(key.x5c[0]));
      }
    });
    this.lastUpdatedAt = new Date().getTime();
  }

  /**
   * Returns whether the key cache is stale or not.
   */
  cacheIsStale() {
    return new Date().getTime() - this.lastUpdatedAt > this.cacheTime;
  }

  /**
   * Only update the cache if it's stale.
   */
  async updateKeyCacheIfStale() {
    // If the cache is currently being updated wait for it
    // to finish updating before checking again.
    if (this.deferJWKRequest) {
      await this.deferJWKRequest;
    }
    if (this.cacheIsStale()) {
      if (this.cacheIsStale()) {
        try{
          let resolve: (value?: unknown) => void;
          this.deferJWKRequest = new Promise((res) => {
            resolve = res;
          });
          await this.updateKeyCache();
          this.deferJWKRequest = null;
          resolve();
        }catch(err){
          this.deferJWKRequest = null;
          resolve();
          throw err;
        }
      }
    }
  }

  /**
   * Verify an access token. Returns the token payload upon success.
   * @param token JWT to be verified.
   */
  async verifyAccessToken(token: string): Promise<Auth0AccessToken> {
    const decodedToken = this.jwtService.decode(token, { complete: true });
    const publicKey = await this.getSigningKey(decodedToken.header.kid);

    // Use a promise to flatten the callback from verify() to make using
    // async/await easier.
    let resolve: (value?: unknown) => void;
    const deferredPromise = new Promise((res) => (resolve = res));
    let tokenPayload: Auth0AccessToken;
    let verifyErrors: jwt.VerifyErrors = null;
    this.jwtService.verify(
      token,
      publicKey,
      {
        ignoreExpiration: this.ignoreExpiration,
      },
      (err, payload: Auth0AccessToken) => {
        if (err) {
          verifyErrors = err;
        } else {
          tokenPayload = payload;
        }
        resolve();
      },
    );

    await deferredPromise;

    if (verifyErrors) {
      throw verifyErrors;
    }

    return tokenPayload;
  }

  //https://github.com/sgmeyer/auth0-node-jwks-rs256/blob/master/src/lib/utils.js
  static certToPEM = (cert: string) => {
    cert = cert.match(/.{1,64}/g).join('\n');
    cert = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----\n`;
    return cert;
  };
}

export default new Auth0Client();
