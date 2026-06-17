import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export interface AddressOption {
  code: string;
  label: string;
}

interface AddressComboboxProps {
  id?: string;
  options: AddressOption[];
  // Selected code ("" when nothing is selected).
  value: string;
  onChange: (code: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

// Searchable select for a single address level (province/city/barangay).
// Stores the option's code in the form while displaying its label.
export function AddressCombobox({
  id,
  options,
  value,
  onChange,
  onBlur,
  placeholder = "Select…",
  emptyText = "No results found.",
  disabled,
}: AddressComboboxProps) {
  const selected = options.find((option) => option.code === value) ?? null;

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(item) => onChange(item ? item.code : "")}
      itemToStringLabel={(item) => item?.label ?? ""}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        onBlur={onBlur}
        disabled={disabled}
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: AddressOption) => (
            <ComboboxItem key={item.code} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
