/**
 * A simple way to add extra functionality to a socket.io
 * client without having to touch any base code.
 * 
 * AuthService in this example is a service that handles
 * authentication.
 */

import {
  EventNames,
  EventsMap,
  DefaultEventsMap,
  EventParams,
} from '@socket.io/component-emitter';
import { Socket } from 'socket.io-client';

/**
 * Socket.io Client extended with extra methods that handles authentication.
 */
export type AuthSocketClient<T extends EventsMap, K extends EventsMap> = Socket<
  T,
  K
> & {
  authEmit: <Ev extends EventNames<K>>(
    ev: Ev,
    ...args: EventParams<K, Ev>
  ) => Promise<AuthSocketClient<T, K>>;
  authConnect: () => Promise<AuthSocketClient<T, K>>;
};

export const SOCKET_CREDENTIAL_DURATION_THRESHOLD = 10000;

/**
 * Adds additional methods to a socket.io client instance
 * that handles authentication on top of the underlying method.
 *
 * The extra methods only works after the user has logged in.
 */
export class AuthSocket<
  T extends EventsMap = DefaultEventsMap,
  K extends EventsMap = T,
> {
  /** The socket.io client instance*/
  socketClientInstance: AuthSocketClient<T, K>;
  authService: AuthService;
  /**
   * Threshold for the duration that the socket's credential
   * are still valid for before they are updated with refreshed
   * credentials.
   */
  credentialRefreshThreshold: number;
  /** 
   * The time at which the auth credentials will expire.
   * This is being kept track of due to the fact that the socket's
   * credentials are not necessarily in sync with the base app's.
   */
  credentialsExpiresAt = 0;
  /**
   * This is use to make sure multiple calls to
   * refresh socket auth credentials are not happening
   * in the same time.
   */
  credentialRefreshLock: PromiseLockResult | null;

  constructor(
    socketInstance: Socket,
    auth = authService,
    refreshThreshold = SOCKET_CREDENTIAL_DURATION_THRESHOLD,
  ) {
    this.socketClientInstance = socketInstance as AuthSocketClient<T, K>;
    this.authService = auth;
    this.credentialRefreshThreshold = refreshThreshold;
    this.credentialRefreshLock = null;
    this.socketClientInstance.authEmit = this._authEmit.bind(this);
    this.socketClientInstance.authConnect = this._authConnect.bind(this);
  }

  /**
   * Returns a socket.io client instance that's been extended with
   * extra authEmit and authConnect methods that handles authentication
   * for requests.
   */
  getSocketClientInstance() {
    return this.socketClientInstance;
  }

  private async _authConnect() {
    if (!this.authService.userIsAuthenticated()) {
      throw new TypeError(
        'User must be logged in to connect to socket server.',
      );
    }
    await this._refreshCredentialsIfNecessary();
    return this.socketClientInstance.connect();
  }

  private async _authEmit<Ev extends EventNames<K>>(
    ev: Ev,
    ...args: EventParams<K, Ev>
  ) {
    if (!this.authService.userIsAuthenticated()) {
      throw new TypeError('User must be logged in to emit messages.');
    }
    if (await this._refreshCredentialsIfNecessary()) {
      // Reconnect after updating credentials. any message
      // emitted while the socket is disconnected are queued
      // until it's reconnected.
      this.socketClientInstance.disconnect().connect();
    }
    return this.socketClientInstance.emit(ev, ...args);
  }

  /**
   * Only refresh the client's auth credentials when
   * necessary.
   *
   * @returns whether the socket client's auth credentials has been
   * refreshed or not.
   */
  private async _refreshCredentialsIfNecessary(): Promise<boolean> {
    if (this.credentialRefreshLock) {
      await this.credentialRefreshLock.lock;
    }

    const currentTime = new Date().getTime();

    /**
     * Check that the socket's credentials haven't expired yet and it's
     * the same as the current version in the authService.
     */
    if (
      this.credentialsExpiresAt - currentTime >=
      this.credentialRefreshThreshold && 
      this.credentialsExpiresAt === this.authService.getTokenExpireTime()
    ) {
      return false;
    }

    if (
      this.authService.getTokenExpireTime() - currentTime <
      this.credentialRefreshThreshold
    ) {
      /**
       * Create a promise that will resolve after the credentials
       * has been refreshed. This way, any other calls to this method
       * will wait until this is finished before checking the conditions.
       */
      if (this.credentialRefreshLock === null) {
        this.credentialRefreshLock = promiseLock();
      }
      try {
        await this.authService.silentTokenRefresh();
        this.credentialRefreshLock?.unlock();
        this.credentialRefreshLock = null;
      } catch(err) {
        this.credentialRefreshLock?.unlock();
        this.credentialRefreshLock = null;
        throw err;
      }
    }
    this._addCredentials();
    return true;
  }

  /**
   * Add auth credentials to the socket client's
   * auth: {token} object. And update the time at which
   * the added tokens will expire.
   */
  private _addCredentials() {
    this.socketClientInstance.auth = {
      token: this.authService.getAccessToken(),
    };
    this.credentialsExpiresAt = this.authService.getTokenExpireTime();
  }
}

/**
 * Create an authSocket by extending a normal socket io client instance
 * with extra .authEmit and .authConnect methods that integrates with
 * authentication for the app.
 */
export const createAuthSocket = <T extends EventsMap, K extends EventsMap>(
  socket: Socket,
): AuthSocketClient<T, K> => {
  const authSocket = new AuthSocket<T, K>(socket);
  return authSocket.getSocketClientInstance();
};

export interface PromiseLockResult {
  lock: Promise<unknown>;
  unlock: (value?: unknown) => void;
}

/**
 * Using a Promise to control the flow of an async function.
 */
export const promiseLock = (): PromiseLockResult => {
  let resolve: (value: unknown) => void;
  const lock = new Promise<unknown>((res) => (resolve = res));
  const unlock = (value: unknown) => {
    resolve(value);
  };

  return { lock, unlock };
};