/**
 * Convert type T to another type with the same structure but all it's terminal values
 * are of type G.
 *
 * Check all properties in type T, if the value type of property k has {[key: string]: value} pairs
 * then check all of the properties of T[k] etc. until it reaches the properties where that isn't
 * the case, then assign the type of the value of those properties as type G.
 *
 * @example
 *    type A = {a: number, b: string, c: { d: number } }
 *    ConvertValueType<A, string> = {a: string, b: string, c: { d: string } }
 *
 * @see https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
 * @see https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type
 */
export type ConvertValueType<T, G> = {
  [k in keyof T]: T[k] extends Record<any, any>
    ? ConvertValueType<T[k], G>
    : G;
};

/**
 * Define something with key:string so ts will stop saying can't be index.
 */
interface IInputObj {
  [key: string]: any;
}

/**
 * Recursively parse an object and get the path to reach a terminal property.
 * e.g. given input = {a: 1, b:2, c: {d: 4}}, concatenator='$#-', output = {a: 'a', b: 'b', c: {d: 'c$#-d'}}
 * @param obj any object with key: value pairs.
 * @param concatenator provide a string that is used to join the different levels of the
 * objects property together, similar to the argument for Array.join.
 * @returns object with same structure as input but with its own properties as the new values.
 */
export const parseObjPropertyNames = <T>(
  obj: T,
  concatenator: string,
): ConvertValueType<T, string> => {
  /**
   * Helper function to parse through the object properties.
   * @param prevPath The property path of the current level.
   */
  const parse = (input: any, prevPath: string) => {
    //if input value is not an object return the property path leading to it.
    if (!isValidObject(input)) return prevPath;

    //if input is an object, store the parsed results in an new empty object.
    const output: IInputObj = {};

    //parse all properties in input. if prevPath is empty then just use the key
    //otherwise join it with the concatenator.
    for (const key in input) {
      output[key] = parse(
        input[key],
        prevPath ? prevPath + concatenator + key : key,
      );
    }

    return output;
  };

  return parse(obj, '') as ConvertValueType<T, string>;
};

/**
 * check to see if input is an object with key value pairs.
 * @returns boolean
 */
const isValidObject = (obj: any): boolean => {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
};

