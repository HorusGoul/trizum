import { IconWithFallback } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { cn } from "#src/ui/utils.js";
import { createFileRoute } from "@tanstack/react-router";
import { Button, MenuTrigger, Popover } from "react-aria-components";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const parties = [
    {
      id: "0",
      name: "Morosos de siempre",
      description: "No pagadle a Hosaeb",
    },
    {
      id: "1",
      name: "Mario's Party",
      description: "Paga la rata",
    },
    {
      id: "2",
      name: "Test",
      description: "Test",
    },
    {
      id: "3",
      name: "A very very very long party name that should be correctly displayed",
      description:
        "A very very very long party description that should be correctly displayed",
    },
    {
      id: "4",
      name: "Test",
      description: "Test",
    },
    {
      id: "5",
      name: "Test",
      description: "Test",
    },
    {
      id: "6",
      name: "Test",
      description: "Test",
    },
    {
      id: "7",
      name: "Test",
      description: "Test",
    },
    {
      id: "8",
      name: "Test",
      description: "Test",
    },
    {
      id: "9",
      name: "Test",
      description: "Test",
    },
    {
      id: "10",
      name: "Test",
      description: "Test",
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center pr-2">
        <h1 className="pl-4 text-2xl font-bold">OpenCount</h1>

        <div className="flex-1" />

        <MenuTrigger>
          <IconButton icon="ellipsis-vertical" aria-label="Menu" />

          <Popover placement="bottom end">
            <Menu>
              <MenuItem>
                <IconWithFallback name="settings" size={20} className="mr-3" />
                <span className="h-3.5 leading-none">Settings</span>
              </MenuItem>
              <MenuItem>
                <IconWithFallback name="info" size={20} className="mr-3" />
                <span className="h-3.5 leading-none">About</span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>

      <div className="h-2" />

      <div className="container flex flex-1 flex-col gap-4 px-2">
        {parties.map((party) => (
          <Button
            key={party.id}
            className={({
              isPressed,
              isFocusVisible,
              isHovered,
              defaultClassName,
            }) =>
              cn(
                defaultClassName,
                "flex w-full scale-100 flex-col rounded-xl bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:bg-slate-900",
                (isHovered || isFocusVisible) &&
                  "shadow-md dark:bg-slate-800 dark:shadow-none",
                isPressed &&
                  "scale-105 bg-opacity-90 shadow-lg dark:bg-slate-700 dark:shadow-none",
              )
            }
          >
            <span className="text-xl font-medium">{party.name}</span>
            <span className="text-lg">{party.description}</span>
          </Button>
        ))}

        <div className="flex-1" />

        <div className="sticky bottom-6 flex justify-end">
          <MenuTrigger>
            <IconButton
              aria-label="Add or create"
              icon="plus"
              color="accent"
              className="h-14 w-14 shadow-md"
            />

            <Popover placement="top end" offset={16}>
              <Menu className="min-w-60">
                <MenuItem>
                  <IconWithFallback
                    name="ampersand"
                    size={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">Join a Party</span>
                </MenuItem>
                <MenuItem>
                  <IconWithFallback
                    name="list-plus"
                    size={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">Create a new Party</span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      </div>
    </div>
  );
}
