import { useRef, useDeferredValue, useState, useEffect } from 'react';
import {
  TextInput,
  StyleSheet,
  Animated,
  TextInputChangeEventData,
  NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
} from 'react-native';
import SearchIcon from './magnifying-glass.svg';

enum BorderColour {
  INACTIVE = 0,
  ACTIVE = 1,
}

enum BorderWidth {
  INACTIVE = 1,
  ACTIVE = 2,
}

enum BorderPadding {
  INACTIVE = 17,
  ACTIVE = 16,
}

interface ISearchBoxProps {
  onSubmit?: (searchValue: string) => void;
  /** Function to be called when the value of the searchbox changes. */
  onChange?: (searchValue: string) => void;
  /** The duration for the animations in milliseconds for focus/blur events */
  animationDuration?: number;
  placeHolder?: string;
  /** Delayed in ms after the search value changes before it is accepted. default 250. */
  debounceTimeout?: number;
}


const SearchBox = ({
  onChange,
  onSubmit,
  animationDuration = 100,
  placeHolder,
}: ISearchBoxProps) => {
  const borderColor = useRef(new Animated.Value(BorderColour.INACTIVE)).current;
  const borderWidth = useRef(new Animated.Value(BorderWidth.INACTIVE)).current;

  //When border width changes during focus/blur events the content inside also squishes/expands
  //Animate the horizontal padding at the same time to keep the content in place.
  const paddingHorizontal = useRef(
    new Animated.Value(BorderPadding.INACTIVE),
  ).current;

  const [searchValue, setSearchValue] = useState('');
  const deferredSearchValue = useDeferredValue(searchValue);

  /**
   * Use the deferred value to trigger the onChange callback to make sure
   * the UI remains responsive even during heavy use.
   */
  useEffect(() => {
    onChange && onChange(deferredSearchValue);
  }, [deferredSearchValue]);

  const interpolateSearchBorderColour = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CFD6E2', '#1774FF'],
  });

  const changeBorderColor = (
    value: BorderColour,
    duration = animationDuration,
  ) => {
    Animated.timing(borderColor, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
  };

  const changeBorderWidth = (
    value: BorderWidth,
    duration = animationDuration,
  ) => {
    Animated.timing(borderWidth, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
  };

  const changePadding = (value: number, duration = animationDuration) => {
    Animated.timing(paddingHorizontal, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
  };

  const handleFocus = () => {
    changeBorderColor(BorderColour.ACTIVE);
    changeBorderWidth(BorderWidth.ACTIVE);
    changePadding(BorderPadding.ACTIVE);
  };

  const handleBlur = () => {
    changeBorderColor(BorderColour.INACTIVE);
    changeBorderWidth(BorderWidth.INACTIVE);
    changePadding(BorderPadding.INACTIVE);
  };

  const handleChange = ({
    nativeEvent: { text },
  }: NativeSyntheticEvent<TextInputChangeEventData>) => {
    setSearchValue(text);
  };

  const handleSubmit = ({
    nativeEvent: { text },
  }: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    onSubmit && onSubmit(text);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          borderColor: interpolateSearchBorderColour,
          borderWidth,
          paddingHorizontal,
          backgroundColor: '#F0F3F8',
        },
      ]}
    >
      <TextInput
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onSubmitEditing={handleSubmit}
        value={searchValue}
        style={[styles.search, { borderColor: '#CFD6E2' }]}
        autoCapitalize={'none'}
        placeholder={placeHolder || ''}
      />
      <SearchIcon style={styles.icon} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 51,
    borderRadius: 5,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
  },
  search: {
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 20,
    flex: 1,
  },
  icon: {
    marginStart: 5,
  },
});

export default SearchBox;
