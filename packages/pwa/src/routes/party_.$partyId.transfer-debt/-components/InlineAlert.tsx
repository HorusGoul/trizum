import { Alert, AlertDescription, AlertTitle } from "@trizum/ui/Alert";
import { Icon } from "@trizum/ui/Icon";

export function InlineAlert({ title, description }: { title: string; description: string }) {
  return (
    <div className="container px-4 pt-4">
      <Alert variant="default">
        <Icon icon="lucide.badge-info" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    </div>
  );
}
