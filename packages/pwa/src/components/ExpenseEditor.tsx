import type { ExpenseUser } from "#src/lib/expenses.js";
import { useForm } from "@tanstack/react-form";
import { BackButton } from "./BackButton";
import { Suspense, useId } from "react";
import { IconButton } from "#src/ui/IconButton.js";
import { t, Trans } from "@lingui/macro";
import { validateExpenseTitle } from "#src/lib/validation.js";
import { AppTextField } from "#src/ui/TextField.js";
import { CurrencyField } from "./CurrencyField";
import { Icon } from "#src/ui/Icon.js";
import { Button } from "#src/ui/Button.js";
import * as React from "react";

export interface ExpenseEditorFormValues {
  name: string;
  description: string;
  amount: number;
  paidBy: ExpenseUser;
}

interface ExpenseEditorProps {
  title: string;
  onSubmit: (values: ExpenseEditorFormValues) => void;
  defaultValues: ExpenseEditorFormValues;
}

export function ExpenseEditor({
  title,
  onSubmit,
  defaultValues,
}: ExpenseEditorProps) {
  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => onSubmit(value),
  });

  const formId = useId();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton />
        <h1 className="pl-4 text-2xl font-bold">{title}</h1>
        <div className="flex-1" />
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) =>
            canSubmit ? (
              <Suspense fallback={null}>
                <IconButton
                  icon="#lucide/check"
                  aria-label={isSubmitting ? t`Submitting...` : t`Save`}
                  type="submit"
                  form={formId}
                  isDisabled={isSubmitting}
                />
              </Suspense>
            ) : null
          }
        </form.Subscribe>
      </div>

      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <PhotosField />

        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => validateExpenseTitle(value),
          }}
        >
          {(field) => (
            <AppTextField
              label={t`Title`}
              description={t`How do you want to call this expense ? `}
              minLength={1}
              maxLength={50}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={
                field.state.meta.isTouched &&
                field.state.meta.errors?.length > 0
              }
            />
          )}
        </form.Field>

        <form.Field name="amount">
          {(field) => (
            <CurrencyField
              name={field.name}
              label={t`Amount`}
              description="How much did you pay?"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              isInvalid={
                field.state.meta.isTouched &&
                field.state.meta.errors?.length > 0
              }
            />
          )}
        </form.Field>
      </form>
    </div>
  );
}

function PhotosField() {
  const [photos, setPhotos] = React.useState<LocalPhoto[]>([]);

  return (
    <div
      className="no-scrollbar -my-4 flex gap-4 overflow-x-auto py-4"
      onWheel={(e) => {
        // Translate scroll Y to X smoothly
        e.currentTarget.scrollLeft += e.deltaY;
      }}
    >
      {photos.length === 0 ? (
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-xl bg-slate-50 p-4 dark:bg-slate-900 dark:text-slate-500">
          <span className="text-center text-sm">
            <Trans>Upload or capture an image of your receipt</Trans>
          </span>
        </div>
      ) : null}

      {photos.map((photo) => (
        <CurrentPhoto
          key={photo.tempUrl}
          photoUrl={photo.tempUrl}
          onRemove={() => {
            setPhotos((prevPhotos) =>
              prevPhotos.filter((current) => current !== photo),
            );
          }}
        />
      ))}
      <AddPhotoButton
        onPhoto={(photo) => {
          setPhotos((prevPhotos) => [...prevPhotos, ...photo]);
        }}
      />
    </div>
  );
}

interface LocalPhoto {
  tempUrl: string;
  file: File;
}

interface AddPhotoButtonProps {
  onPhoto: (photos: LocalPhoto[]) => void;
}

function AddPhotoButton({ onPhoto }: AddPhotoButtonProps) {
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const localPhotos = Array.from(event.target.files ?? []).map((file) => {
      const tempUrl = URL.createObjectURL(file);
      return { tempUrl, file };
    });

    onPhoto(localPhotos);

    // Reset the input value to allow the user to add more photos
    event.target.value = "";
  }

  function openCamera() {
    cameraInputRef.current?.click();
  }

  function openGallery() {
    galleryInputRef.current?.click();
  }

  return (
    <div className="flex h-32 w-max flex-shrink-0 flex-col gap-2">
      <Button
        onPress={openCamera}
        color="input-like"
        className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-3 text-xs"
      >
        <Icon name="#lucide/camera" className="h-5 w-5" />
        <Trans>Take photo</Trans>
      </Button>

      <Button
        onPress={openGallery}
        color="input-like"
        className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-3 text-xs"
      >
        <Icon name="#lucide/image-up" className="h-5 w-5" />
        <Trans>Upload photo</Trans>
      </Button>

      <input
        type="file"
        className="sr-only"
        accept="image/*"
        capture="environment"
        multiple={false}
        onChange={onFileChange}
        ref={cameraInputRef}
        hidden={true}
      />

      <input
        type="file"
        className="sr-only"
        accept="image/*"
        multiple={true}
        onChange={onFileChange}
        ref={galleryInputRef}
        hidden={true}
      />
    </div>
  );
}

interface CurrentPhotoProps {
  photoUrl: string;
  onRemove: () => void;
}

function CurrentPhoto({ photoUrl, onRemove }: CurrentPhotoProps) {
  return (
    <div className="relative flex-shrink-0">
      <Button
        color="transparent"
        aria-label={t`View photo`}
        className="h-auto w-auto p-0"
      >
        <img
          src={photoUrl}
          className="block h-32 w-32 rounded-xl object-cover"
          alt=""
          onContextMenu={(e) => e.preventDefault()}
        />
      </Button>
      <Button
        color="slate"
        className="absolute -right-2 -top-2 h-auto w-auto rounded-full p-1"
        onPress={onRemove}
      >
        <Icon
          name="#lucide/x"
          className="h-4 w-4"
          aria-label={t`Remove photo`}
        />
      </Button>
    </div>
  );
}
