import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type ClassName = ClassValue;

export function cn(...className: ClassName[]) {
  return twMerge(clsx(className));
}

const isBoolean = (maybeBoolean: unknown): maybeBoolean is boolean =>
  typeof maybeBoolean === "boolean";
const toStringIfBoolean = (value: unknown): string | unknown =>
  isBoolean(value) ? String(value) : value;
const isSimpleSubset = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
) => Object.entries(a).every(([key, value]) => b[key] === value);

type Variants = {
  [key: string]: {
    [key: string]: string;
  };
};

type CompoundVariant<SchemaVariants extends Variants> = {
  [Key in keyof SchemaVariants]?: keyof SchemaVariants[Key];
} & {
  classes: string;
};

type Options<SchemaVariants extends Variants> = {
  [Key in keyof SchemaVariants]?: keyof SchemaVariants[Key];
};

type Schema<SchemaVariants extends Variants> = {
  base: string;
  defaultVariants: {
    [K in keyof SchemaVariants]: keyof SchemaVariants[K];
  };
  variants: SchemaVariants;
  compoundVariants: CompoundVariant<SchemaVariants>[];
};

export type VariantsFromProps<
  // eslint-disable-next-line @typescript-eslint/ban-types
  Props extends {},
  RequiredProps = Required<Props>,
> = {
  [Key in keyof RequiredProps]: RequiredProps[Key] extends
    | string
    | symbol
    | number
    ? {
        [Variant in RequiredProps[Key]]: string;
      }
    : never;
};

export const cva =
  <SchemaVariants extends Variants>(
    schema: Partial<Schema<SchemaVariants>> = {},
  ) =>
  (options: Options<SchemaVariants> = {}, classNames: ClassName = []) => {
    const {
      base,
      defaultVariants = {},
      variants = {},
      compoundVariants = [],
    } = schema;

    const optionsWithUndefinedsRemoved = Object.entries(options).reduce(
      (acc, [key, value]) => {
        if (value === undefined) {
          return acc;
        }

        acc[key] = value;
        return acc;
      },
      {} as Record<string, unknown>,
    );

    const currentOptions = {
      ...defaultVariants,
      ...optionsWithUndefinedsRemoved,
    };

    return cn([
      base,
      Object.keys(variants).map((variantName) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return variants[variantName][
          toStringIfBoolean(options[variantName]) ||
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            defaultVariants[variantName]
        ];
      }),
      compoundVariants.reduce(
        (list, { classes, ...compoundVariantOptions }) => {
          if (isSimpleSubset(compoundVariantOptions, currentOptions)) {
            list.push(classes);
          }
          return list;
        },
        [] as string[],
      ),
      classNames,
    ]);
  };
