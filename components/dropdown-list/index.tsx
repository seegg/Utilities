import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, ScrollView, Modal, View } from 'react-native';
import CaretIcon from './caret.svg';
import { OptionTitle } from './OptionTitle';
import Label from './Label';
import SearchBox from './SearchBox';
import ListOption from './Option';

export interface ListOption<T> {
  title: string;
  value: T;
}
interface IDropDownListProps<T> {
  /** Array of options to be displayed on the select list.*/
  listOptions?: ListOption<T>[];
  /**
   * Function to be called on selecting a value. The value and title of the selected
   * option is passed as arguments.
   */
  onSelect?: (value: T, title?: string) => void;
  /** String to be displayed when no option has been selected.*/
  placeHolder?: string;
  /** Optional label that is displayed on the top left of the component. */
  label?: string;
  selectedValue?: T | null;
  disabled?: boolean;
}

const DropDownSelectList = <T,>({
  listOptions = [],
  onSelect,
  placeHolder,
  label,
  selectedValue,
  disabled = false,
}: IDropDownListProps<T>) => {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string | null>(null);

  /**
   * The search filter will try to match the start of each word in the option title. The search is case
   * insensitive and the title string is split into substrings by a whitespace ' '.
   */
  const filteredList = searchFilter
    ? listOptions.filter(({ title }) => {
        const titleWords = title.split(' ');
        return titleWords.some((word) =>
          word.toLocaleLowerCase().startsWith(searchFilter),
        );
      })
    : listOptions;

  //display the title of the selected option on the component.
  useEffect(() => {
    const selected = listOptions.find((item) => item.value === selectedValue);
    if (selected) {
      setTitle(selected.title);
    } else {
      setTitle(null);
    }
  }, [selectedValue, listOptions]);

  const handlePress = () => {
    setShowModal((state) => !state);
  };

  const handleRequestClose = () => {
    setShowModal(false);
    setSearchFilter(null);
  };

  const handleSelect = (value: T, title?: string) => {
    if (onSelect) {
      onSelect(value, title);
    }
    setShowModal(false);
    setSearchFilter(null);
  };

  const handleSearchChange = (searchValue: string) => {
    setSearchFilter(searchValue.toLocaleLowerCase());
  };

  return (
    <View>
      {label && <Label style={styles.label}>{label}</Label>}
      <Pressable
        style={[
          styles.container,
          { borderColor: '#CFD6E2', opacity: disabled ? 0.5 : 1 },
        ]}
        onPress={handlePress}
        disabled={disabled}
      >
        <OptionTitle numberOfLines={1}>
          {title !== null ? title : placeHolder}
        </OptionTitle>
        <CaretIcon color={'#95A3BB'} />
      </Pressable>
      <Modal
        visible={showModal}
        transparent={true}
        onRequestClose={handleRequestClose}
        animationType={'fade'}
      >
        <View
          style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.2)' }]}
        >
          <ScrollView
            style={styles.modalView}
            stickyHeaderIndices={[0]}
            keyboardShouldPersistTaps={'handled'}
            contentContainerStyle={{ paddingBottom: 50 }}
          >
            <SearchBox onChange={handleSearchChange} />
            {filteredList.map(({ title, value }) => {
              return (
                <ListOption<T>
                  key={title + value}
                  title={title}
                  value={value}
                  isSelected={value === selectedValue}
                  onPress={handleSelect}
                />
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 51,
    borderRadius: 5,
    borderWidth: 1,
    paddingLeft: 17,
    paddingRight: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    includeFontPadding: false,
    marginBottom: 6,
  },
  modalContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalView: {
    flexGrow: 0,
    margin: 20,
    padding: 10,
    width: 350,
    height: '90%',
    maxHeight: 750,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    backgroundColor: 'white',
  },
});

export default DropDownSelectList;
