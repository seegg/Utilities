import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Easing,
  Platform,
} from 'react-native';

export enum BottomDrawerActions {
  OPEN = 'open',
  CLOSE = 'close',
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
   * gesture it will trigger the expand animation. default: 200.
   */
  heightThreshold?: number;
  /** Trigger the open and close animation for the drawer at each render for the component. */
  drawerAction?: BottomDrawerActions;
  /** Function to be called when the BottomDrawer component opens. */
  onDrawerOpen?: () => void;
  /** Function to be called when the BottomDrawer component closes. */
  onDrawerClose?: () => void;
  /** Left and right corner radius of the drawer, default: 25 */
  topCornerRadius?: number;
  /** Custom dragbar component to render on the drawer. */
  dragBar?: null | React.FC;
  children?: ReactNode;
}

/**
 * Bottom drawer wrapper for other components.
 */
const BottomDrawer = ({
  animationDuration = 500,
  minHeight = 17,
  maxHeight = 500,
  gestureVelocityThreshold = 0.5,
  heightThreshold = 200,
  topCornerRadius = 25,
  drawerAction,
  onDrawerClose,
  onDrawerOpen,
  dragBar = null,
  children,
}: IDrawerProps) => {

  //Use to animate the drawer height.
  const heightAnim = useRef(new Animated.Value(minHeight)).current;

  //Current drawer height. Updated from Animated.value callback.
  const currentHeight = useRef(minHeight);

  //Max drawer height, useRef to prevent stale value inside panResponder.
  const heightMax = useRef(maxHeight);

  //use to keep track of the initial height inside panResponder at the start of a gesture.
  const heightInitial = useRef(0);

  /**
   * Keep track of the open and close state of the drawer. Use 'initialOpen' and 'InitialClose'
   * as the starting state so that when the component is first render the callback functions trigger
   * by 'open' and 'close' are not triggered.
   */
  const [drawerState, setDrawerState] = useState<
    BottomDrawerActions | 'initialClose' | 'initialOpen'
  >('initialClose');

  /**
   * Workaround for accessing the latest drawerState within the Animated callback.
   */
  const drawerStateRef = useRef(drawerState);

  //Trigger the height animation base on the drawerAction prop. This allows another component
  //to open and close the drawer programmatically.
  useEffect(() => {
    switch (drawerAction) {
      case BottomDrawerActions.OPEN:
        animateHeight(maxHeight);
        break;
      case BottomDrawerActions.CLOSE:
        animateHeight(minHeight);
        break;
      default:
    }
  }, [drawerAction]);



  //Trigger the drawer open/close callback function base on the drawer state.
  useEffect(() => {
    switch (drawerState) {
      case BottomDrawerActions.CLOSE:
        !!onDrawerClose && onDrawerClose();
        break;
      case BottomDrawerActions.OPEN:
        !!onDrawerOpen && onDrawerOpen();
        break;
    }
    drawerStateRef.current = drawerState;
  }, [drawerState]);

  /**
   * Function to be called at the end of the Animated height function. Use to decide
   * if the drawer state needs to be updated base on the current drawer height.
   */
  const handleOpenCloseState = () => {
    /**
     * If the difference between the minHeight/maxHeight and currentHeight is less than the
     * threshold then the drawer is consider 'close'/'open'. Not using exact values because of
     * floats.
     */
    const heightDiffThreshold = 2;

    const maxHeightDifference = Math.abs(maxHeight - currentHeight.current);
    const minHeightDifference = Math.abs(currentHeight.current - minHeight);

    if (maxHeightDifference <= heightDiffThreshold) {
      if (
        drawerStateRef.current === BottomDrawerActions.OPEN ||
        drawerStateRef.current === 'initialOpen'
      ) {
        return;
      }
      setDrawerState(BottomDrawerActions.OPEN);
      return;
    }

    if (minHeightDifference <= heightDiffThreshold) {
      if (
        drawerStateRef.current === BottomDrawerActions.CLOSE ||
        drawerStateRef.current === 'initialClose'
      ) {
        return;
      }

      setDrawerState(BottomDrawerActions.CLOSE);
    }
  };

  /**
   * Animate the change in drawer height. At the end of the animation, if currentHeight
   * is closer to the minHeight then the drawer is consider 'close', and if it's
   * closer to maxHeight then the drawer is consider 'open'
   * @param toHeight The height to animate to.
   * @param duration The duration of the animation.
   */
  const animateHeight = (toHeight: number, duration = animationDuration) => {
    Animated.timing(heightAnim, {
      toValue: toHeight,
      duration: duration,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start(() => {
      handleOpenCloseState();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        //initial drawer height at the start of the gesture.
        heightInitial.current = currentHeight.current;
      },
      onPanResponderMove: (e, { dy }) => {
        //Subtract the changes in the y axis from the initial height to get
        //the new height, only apply the changes if it's within the min max range.
        const adjustedHeight = heightInitial.current - dy;

        if (adjustedHeight > heightMax.current) {
          heightAnim.setValue(heightMax.current);
        } else if (adjustedHeight < minHeight) {
          heightAnim.setValue(minHeight);
        } else {
          heightAnim.setValue(adjustedHeight);
        }
      },
      onPanResponderRelease: (e, { vy }) => {
        //if the gesture's latest y velocity is over the threshold,
        //open or collapse the drawer base on the velocity's direction.
        if (Math.abs(vy) > gestureVelocityThreshold) {
          if (vy > 0) {
            animateHeight(minHeight);
          } else {
            animateHeight(heightMax.current);
          }
          return;
        }

        //if the drawer has open pass the height threshold
        //open it to max height otherwise collapse it back down.
        if (currentHeight.current - minHeight > heightThreshold) {
          animateHeight(heightMax.current);
        } else {
          animateHeight(minHeight);
        }
      },
    }),
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
          height: heightAnim,
          borderTopLeftRadius: topCornerRadius,
          borderTopRightRadius: topCornerRadius,
        },
      ]}
    >
      <View {...panResponder.panHandlers}>
        {dragBar ? dragBar() : <View style={{height: 20}}/>}
      </View>
      <View style={{ overflow: 'hidden', flex: 1 }}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderTopWidth: 4,
    borderTopColor: 'rgba(0,0,0,0.005)',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: 'white',
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
