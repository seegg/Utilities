import { Text, TextProps, StyleSheet } from 'react-native';

const Label = ({ children, style = {}, ...props }: TextProps) => {
  return (
    <Text style={[styles.text, style]} {...props}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontStyle: 'normal',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default Label;