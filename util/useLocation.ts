import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
// Implementation for redux is not shown.
import { setLocationPermissionStatus } from './location/slice';
import { useTypedSelector, useAppDispatch } from '../redux/store';

export const LOCATION_UPDATE_INTERVAL = 10000;

export type GeoCoordinate = {
  latitude: number;
  longitude: number;
}

export interface UseLocationHookResult {
  /** Coordinates of the user's location. */
  userLocation: GeoCoordinate | null;
  /** Whether to open Settings or not. */
  shouldOpenSettings: boolean;
  /** The statuses of the current location permission for the device. */
  permissionStatus: Location.LocationPermissionResponse | null;
  /** Ask the user to grant permission for device location. */
  requestLocationPermission: () => Promise<void>;
  /**
   * Automatically update user location as new position
   * information comes in.
   */
  subscribeToLocationUpdates: () => void;
  /**
   * Unsubscribe to location updates, will only have any effect
   * if a location update subscription is active.
   */
  unSubscribeToLocationUpdates: () => void;
}

export interface UseLocationHookOptions {
  /** whether to subscribe to location updates or not, defaults to false. */
  subscribeToUpdates: boolean;
  defaultLocation?: GeoCoordinate;
}

/**
 * A hook for handling device location.
 *
 * If location permission has been granted this will
 * be based on the user's device location, otherwise
 * this will be a static value retrieve from the user's
 * profile data.
 *
 * Accepts an optional config for things such as subscribing
 * to location updates.
 *
 * @returns an object containing the user's location.
 */
export const useLocation = (
  config: UseLocationHookOptions = {subscribeToUpdates: false},
): UseLocationHookResult => {
  const [userLocation, setUserLocation] = useState<null | GeoCoordinate>(null);
  const [isSubscribeToLocationUpdates, setIsSubscribeToLocationUpdates] =
    useState(config.subscribeToUpdates);
  const [defaultLocation, setDefaultLocation] = useState<GeoCoordinate | undefined>(config?.defaultLocation);
  const { permissionStatus } = useTypedSelector((state) => state.location);
  const dispatch = useAppDispatch();

  if(config.defaultLocation?.latitude !== defaultLocation?.latitude ||
      config.defaultLocation?.longitude !== defaultLocation?.longitude
    ){
      setDefaultLocation(config.defaultLocation? {...config.defaultLocation } : undefined);
    }

  /**
   * shouldOpenSettings decides if the settings app should
   * be use opened when requesting location. For use when permission
   * is unable to be acquired through expo-location.
   *
   * useRef to make sure the value remains fresh when used
   * in callback functions.
   */
  const shouldOpenSettings = useRef(false);

  const dispatchLocationStatusUpdate = (
    status: Location.LocationPermissionResponse,
  ) => {
    dispatch(setLocationPermissionStatus(status));
  };

  /**
   * If the location status in the redux state hasn't been
   * set yet then fetch it and set the initial value.
   */
  useEffect(() => {
    if (permissionStatus !== null) {
      return;
    }
    (async () => {
      dispatchLocationStatusUpdate(
        await Location.getForegroundPermissionsAsync(),
      );
    })();
  }, []);

  /**
   * Handle getting and setting the user's location based on
   * location permission status.
   */
  useEffect(() => {
    // Location permission hasn't been fetched yet.
    if (permissionStatus === null) {
      return;
    }
    (async () => {
      // Check if location permission has been granted, if yes then
      // get the user's location from their device, if not use the
      // user's location from their profile.
      setUserLocation(
        defaultLocation?.latitude && defaultLocation.longitude
          ? {...defaultLocation}
          : null,
      );
      if (permissionStatus.granted) {
        const position = await Location.getLastKnownPositionAsync();
        if (position) {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      }
    })();
  }, [permissionStatus?.granted]);

  /**
   * Handles subscribing and unsubscribing from location updates.
   */
  useEffect(() => {
    if (!isSubscribeToLocationUpdates) {
      return;
    }
    /** Reference to the location subscription use for clean up. */
    let locationSubscription: Location.LocationSubscription;

    (async () => {
      // Subscribe to location updates, and update the userLocation
      // state as new info comes in.
      if (permissionStatus?.granted) {
        locationSubscription = await Location.watchPositionAsync(
          { timeInterval: LOCATION_UPDATE_INTERVAL },
          ({ coords }) => {
            setUserLocation(coords);
          },
        );
      } else {
        setUserLocation(
          defaultLocation?.latitude && defaultLocation.longitude
            ? {...defaultLocation}
            : null,
        );
      }
    })();
    return () => {
      locationSubscription?.remove();
    };
  }, [permissionStatus?.granted, isSubscribeToLocationUpdates]);

  /**
   * Ask the user for location permission. If permission
   * is unable to be requested through the app then the settings
   * app will be used.
   */
  const requestLocationPermission = useCallback(async () => {
    if (shouldOpenSettings.current) {
      // When opening settings, add a event handler for app state,
      // when the app comes back to the foreground, get current
      // foreground location permission and update state.
      const subscription = AppState.addEventListener(
        'change',
        async (nextAppState) => {
          if (nextAppState === 'active') {
            // Remove the subscription because it's no longer necessary to
            // listen for app state changes.
            subscription.remove();
            dispatch(
              setLocationPermissionStatus(
                await Location.getForegroundPermissionsAsync(),
              ),
            );
          }
        },
      );
      Linking.openSettings();
    } else {
      const result = await Location.requestForegroundPermissionsAsync();
      if (!result.canAskAgain && !result.granted) {
        shouldOpenSettings.current = true;
      }
      dispatchLocationStatusUpdate(result);
    }
  }, []);

  const subscribeToLocationUpdates = useCallback(() => {
    setIsSubscribeToLocationUpdates(true);
  }, []);

  const unSubscribeToLocationUpdates = useCallback(() => {
    setIsSubscribeToLocationUpdates(false);
  }, []);

  return {
    userLocation,
    permissionStatus,
    requestLocationPermission,
    shouldOpenSettings: shouldOpenSettings.current,
    subscribeToLocationUpdates,
    unSubscribeToLocationUpdates,
  };
};
