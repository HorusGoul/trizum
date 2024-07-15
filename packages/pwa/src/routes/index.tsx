import { IconWithFallback } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { createFileRoute } from "@tanstack/react-router";
import { MenuTrigger, Popover } from "react-aria-components";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <div className="container flex h-16 items-center pr-2">
        <h1 className="pl-4 text-2xl font-bold">OpenCount</h1>

        <div className="flex-1" />

        <MenuTrigger>
          <IconButton icon="ellipsis-vertical" aria-label="Menu" />

          <Popover>
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
    </>
  );
}
