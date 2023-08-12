import { Text, TextProps, StyleSheet } from 'react-native';

export const OptionTitle = ({ children, style = {}, ...props }: TextProps) => {
  return (
    <Text style={[styles.text, style]} {...props}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontStyle: 'normal',
    fontSize: 16,
    lineHeight: 20,
  },
});
