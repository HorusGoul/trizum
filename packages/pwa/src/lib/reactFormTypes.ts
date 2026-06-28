import type {
  FormAsyncValidateOrFn,
  FormValidateOrFn,
  ReactFormExtendedApi,
} from "@tanstack/react-form";

type AppFormValidate<TFormData> = FormValidateOrFn<TFormData> | undefined;
type AppFormAsyncValidate<TFormData> = FormAsyncValidateOrFn<TFormData> | undefined;

export type AppFormApi<TFormData> = ReactFormExtendedApi<
  TFormData,
  AppFormValidate<TFormData>,
  AppFormValidate<TFormData>,
  AppFormAsyncValidate<TFormData>,
  AppFormValidate<TFormData>,
  AppFormAsyncValidate<TFormData>,
  AppFormValidate<TFormData>,
  AppFormAsyncValidate<TFormData>,
  AppFormValidate<TFormData>,
  AppFormAsyncValidate<TFormData>,
  AppFormAsyncValidate<TFormData>,
  unknown
>;
