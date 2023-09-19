import React, {
  ReactNode,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Easing,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';

export enum BottomDrawerActions {
  OPEN = 'open',
  CLOSE = 'close',
}

type UnsubscribeFn = () => void;
export interface DrawerFunctions {
  /**
   * Open the bottom drawer. Accepts an delay in ms as an optional
   * argument.
   */
  open: (delay?: number) => void;
  /**
   * Add a listener that is invoked when the drawer opens/closes.
   *
   * @returns The unsubscribe function.
   */
  addEventListener: (
    event: 'onOpen' | 'onClose',
    listener: () => void,
  ) => UnsubscribeFn;
}

interface IDrawerProps {
  /**
   * Min height of the drawer, set it to a value for the components
   * that you want to be visible when the drawer is close.
   * */
  minHeight?: number;
  /** Max height of the drawer. */
  maxHeight: number;
  /** Duration of the expanding/shrink animation, in milliseconds. */
  animationDuration?: number;
  /** Minimum gesture y-axis velocity to trigger open/close animation. default: 0.5 */
  gestureVelocityThreshold?: number;
  /**
   * If drawer height expands more than this value at the end of the
   * gesture it will trigger the expand animation. default: 100.
   */
  heightThreshold?: number;
  /** Custom style for the drawer. */
  style?: StyleProp<ViewStyle>;
  /** Custom dragbar component. */
  dragBar?: React.FC;
  children?: ReactNode;
}

/**
 * Bottom drawer wrapper for other components.
 */
const BottomDrawer = forwardRef<DrawerFunctions, IDrawerProps>(
  function BottomDrawer(props: IDrawerProps, ref) {
    const {
      animationDuration = 500,
      minHeight = 17,
      maxHeight = 500,
      gestureVelocityThreshold = 0.5,
      heightThreshold = 100,
      style = {},
      dragBar: Dragbar = null,
      children,
    } = props;

    /** Max y translate. i.e. drawer is close. */
    const maxDrawerHeight = maxHeight - minHeight;

    /** Use to animate the drawer height. */
    const heightAnim = useRef(new Animated.Value(maxDrawerHeight)).current;
    /** Current drawer height. Updated from Animated.value callback.*/
    const currentHeight = useRef(maxDrawerHeight);
    /** Max drawer height, useRef to prevent stale value inside panResponder.*/
    const heightMax = useRef(maxHeight);
    /** use to keep track of the initial height inside panResponder at the start of a gesture.*/
    const heightInitial = useRef(0);

    /**
     * Stores the callback functions that are invoked when the drawer opens.
     */
    const onOpenListeners = useRef<Map<any, () => void>>(new Map());
    /**
     * Stores the callback functions that are invoked when the drawer closes.
     */
    const onCloseListeners = useRef<Map<any, () => void>>(new Map());

    /**
     * Keep track of the open and close state of the drawer. Use 'initialOpen' and 'InitialClose'
     * as the starting state so that when the component is first render the callback functions trigger
     * by 'open' and 'close' are not triggered.
     */
    const drawerState = useRef<
      BottomDrawerActions | 'initialClose' | 'initialOpen'
    >('initialClose');

    /**
     * Function to be called at the end of the Animated height function. Use to decide
     * if the drawer state needs to be updated base on the current drawer height.
     */
    const handleOnOpenCloseDrawer = () => {
      /**
       * If the difference between the minHeight/maxHeight and currentHeight is less than the
       * threshold then the drawer is consider 'close'/'open'.
       */
      const heightDiffThreshold = 2;

      if (Math.abs(currentHeight.current) <= heightDiffThreshold) {
        if (
          drawerState.current === BottomDrawerActions.OPEN ||
          drawerState.current === 'initialOpen'
        ) {
          return;
        }
        drawerState.current = BottomDrawerActions.OPEN;
        onOpenListeners.current.forEach((listener) => {
          listener();
        });
        return;
      }

      if (
        Math.abs(currentHeight.current - maxDrawerHeight) <= heightThreshold
      ) {
        if (
          drawerState.current === BottomDrawerActions.CLOSE ||
          drawerState.current === 'initialClose'
        ) {
          return;
        }
        drawerState.current = BottomDrawerActions.CLOSE;
        onCloseListeners.current.forEach((listener) => {
          listener();
        });
      }
    };

    /**
     * Animate the change in drawer height. At the end of the animation, if currentHeight
     * is closer to the minHeight then the drawer is consider 'close', and if it's
     * closer to maxHeight then the drawer is consider 'open'
     * @param toHeight The height to animate to.
     * @param delay Optional delay before starting the animation.
     * @param duration The duration of the animation.
     */
    const animateHeight = useCallback(
      (toHeight: number, delay = 0, duration = animationDuration) => {
        Animated.timing(heightAnim, {
          toValue: toHeight,
          duration: duration,
          easing: Easing.out(Easing.exp),
          delay,
          useNativeDriver: true,
        }).start(() => {
          handleOnOpenCloseDrawer();
        });
      },
      [],
    );

    /**
     * Methods for adding listeners and for controlling the behaviour
     * of the drawer.
     */
    useImperativeHandle<DrawerFunctions, DrawerFunctions>(
      ref,
      () => {
        return {
          open: (delay = 0) => {
            animateHeight(0, delay);
          },
          addEventListener: (event, listener) => {
            if (event === 'onOpen') {
              onOpenListeners.current.set(listener, listener);
              return () => {
                onOpenListeners.current.delete(listener);
              };
            }
            onCloseListeners.current.set(listener, listener);
            return () => {
              onCloseListeners.current.delete(listener);
            };
          },
        };
      },
      [],
    );

    const panResponder = useRef(
      useMemo(() => {
        return PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            //initial drawer height at the start of the gesture.
            heightInitial.current = currentHeight.current;
          },
          onPanResponderMove: (_, { dy }) => {
            //Subtract the changes in the y axis from the initial height to get
            //the new height, only apply the changes if it's within the min max range.
            const adjustedHeight = heightInitial.current + dy;
            if (adjustedHeight < 0) {
              heightAnim.setValue(0);
            } else if (adjustedHeight > maxDrawerHeight) {
              heightAnim.setValue(maxDrawerHeight);
            } else {
              heightAnim.setValue(adjustedHeight);
            }
          },
          onPanResponderRelease: (_, { dy, vy }) => {
            //if the gesture's latest y velocity is over the threshold,
            //open or collapse the drawer base on the velocity's direction.
            if (Math.abs(vy) > gestureVelocityThreshold) {
              if (vy > 0) {
                animateHeight(maxDrawerHeight);
              } else {
                animateHeight(0);
              }
              return;
            }
            let open = false;
            // if the drawer has open pass the height threshold
            // open/close it base on the current drawer state.
            if (heightThreshold - Math.abs(dy) < 0) {
              if (
                drawerState.current === 'initialClose' ||
                drawerState.current === BottomDrawerActions.CLOSE
              ) {
                open = true;
              }
            } else if (
              drawerState.current === 'initialOpen' ||
              drawerState.current === BottomDrawerActions.OPEN
            ) {
              open = true;
            }
            if (open) {
              animateHeight(0);
            } else {
              animateHeight(maxDrawerHeight);
            }
          },
        });
      }, []),
    ).current;

    //set up the handlers for animated height change.
    useEffect(() => {
      //Update the height ref when the animated value changes.
      heightAnim.addListener(({ value }) => {
        currentHeight.current = value;
      });

      //clean up.
      return () => {
        if (heightAnim.hasListeners()) {
          heightAnim.removeAllListeners();
        }
      };
    }, []);

    //Update max height if there any changes from parent component.
    useEffect(() => {
      heightMax.current = maxHeight;
    }, [maxHeight]);

    return (
      <Animated.View
        style={[
          styles.container,
          {
            height: maxHeight,
            transform: [{ translateY: heightAnim }],
          },
          style,
        ]}
      >
        <View {...panResponder.panHandlers}>
          {Dragbar ? <Dragbar /> : <DefaultDragBar />}
        </View>
        <View style={{ overflow: 'hidden', flex: 1 }}>{children}</View>
      </Animated.View>
    );
  },
);

const DefaultDragBar = () => {
  return (
    <View
      style={{
        height: 17,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View 
        style={{
          width: 100,
          borderBottomWidth: 1,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'absolute',
    borderTopWidth: 4,
    bottom: 0,
    borderTopColor: 'rgba(0,0,0,0.005)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
    shadowColor: 'black',
    ...Platform.select({
      android: { elevation: 20 },
      ios: {
        shadowOffset: {
          width: 0,
          height: 10,
        },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
    }),
  },
});

export default BottomDrawer;
