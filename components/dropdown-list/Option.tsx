import { useRef, useEffect } from 'react';
import { Pressable, StyleSheet, Animated, Text, TextProps } from 'react-native';

interface IListOptionProps<T> {
  title: string;
  value: T;
  isSelected?: boolean;
  onPress?: (value: T, title?: string) => void;
}
/**
 * Option component inside a dropdown select list.
 */
const ListOption = <T,>({
  title,
  value,
  isSelected = false,
  onPress,
}: IListOptionProps<T>) => {

  const animatedBackground = useRef(new Animated.Value(0)).current;
  const interpolatedBackground = animatedBackground.interpolate({
    inputRange: [0, 100],
    outputRange: ['white', 'gray'],
  });

  //Set the background colour if isSelected is true.
  useEffect(() => {
    if (isSelected) {
      animatedBackground.setValue(100);
    }
  }, [isSelected]);

  const animateBackgroundChange = (value: number) => {
    //Don't trigger background colour change if isSelected is true.
    if (isSelected) {
      return;
    }
    Animated.timing(animatedBackground, {
      toValue: value,
      duration: 100,
      useNativeDriver: false,
    }).start();
  };

  const handleOnPress = () => {
    onPress && onPress(value, title);
  };

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: interpolatedBackground }]}
    >
      <Pressable
        style={styles.listOption}
        onPressIn={() => {
          animateBackgroundChange(100);
        }}
        onPressOut={() => {
          animateBackgroundChange(0);
        }}
        onPress={handleOnPress}
      >
        <OptionTitle>{title}</OptionTitle>
      </Pressable>
    </Animated.View>
  );
};

export const OptionTitle = ({ children, style = {}, ...props }: TextProps) => {
  return (
    <Text style={[styles.title, style]} {...props}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    marginVertical: 2,
  },
  listOption: {
    width: '100%',
    minHeight: 50,
    justifyContent: 'center',
    paddingStart: 5,
  },
  title: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontStyle: 'normal',
    fontSize: 16,
    lineHeight: 20,
  }
});

export default ListOption;
