import type { Meta, StoryObj } from "@storybook/react-vite";
import { MenuTrigger } from "react-aria-components";
import {
  AppSelect,
  SelectItem,
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopover,
  SelectListBox,
  SelectSection,
  SelectHeader,
  SelectCollection,
} from "@trizum/ui/Select";
import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
  ListBoxHeader,
  ListBoxCollection,
} from "@trizum/ui/ListBox";
import { Menu, MenuItem } from "@trizum/ui/Menu";
import { Popover } from "@trizum/ui/Popover";
import { Label } from "@trizum/ui/fields/Field";
import { Button } from "@trizum/ui/Button";

const meta = {
  title: "Components/Collections",
  parameters: {
    docs: {
      description: {
        component:
          "Select and list-box collections support sections, headers, keyboard navigation, and selection. MenuItem accepts async menuAction callbacks.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

const items = [
  { id: "one", name: "First" },
  { id: "two", name: "Second" },
];

export const SelectField: Story = {
  render: () => (
    <AppSelect label="Choose an option" defaultSelectedKey="one">
      <SelectItem id="one">First</SelectItem>
      <SelectItem id="two">Second</SelectItem>
    </AppSelect>
  ),
};

export const DisabledSelect: Story = {
  render: () => (
    <AppSelect label="Choose an option" isDisabled>
      <SelectItem id="one">First</SelectItem>
    </AppSelect>
  ),
};

export const ComposedSelect: Story = {
  render: () => (
    <Select>
      <Label>Choose</Label>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectPopover>
        <SelectListBox>
          <SelectSection>
            <SelectHeader>Options</SelectHeader>
            <SelectCollection items={items}>
              {(item) => <SelectItem>{item.name}</SelectItem>}
            </SelectCollection>
          </SelectSection>
        </SelectListBox>
      </SelectPopover>
    </Select>
  ),
};

export const Selection: Story = {
  render: () => (
    <ListBox aria-label="Options" selectionMode="single" defaultSelectedKeys={["one"]}>
      <ListBoxItem id="one">First</ListBoxItem>
      <ListBoxItem id="two">Second</ListBoxItem>
    </ListBox>
  ),
};

export const Sections: Story = {
  render: () => (
    <ListBox aria-label="Options">
      <ListBoxSection>
        <ListBoxHeader>Options</ListBoxHeader>
        <ListBoxCollection items={items}>
          {(item) => <ListBoxItem>{item.name}</ListBoxItem>}
        </ListBoxCollection>
      </ListBoxSection>
    </ListBox>
  ),
};

export const Actions: Story = {
  render: () => (
    <MenuTrigger>
      <Button>Open menu</Button>
      <Popover>
        <Menu aria-label="Actions">
          <MenuItem id="edit">Edit</MenuItem>
          <MenuItem id="remove" isDisabled>
            Remove
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  ),
};
