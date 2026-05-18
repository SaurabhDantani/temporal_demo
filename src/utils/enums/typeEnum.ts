export enum TypeEnum {
  Mainboard = 1,
  SME = 2,
}

// ENUM → STRING strict map
export const TypeEnumStringMap = {
  [TypeEnum.Mainboard]: 'mainboard',
  [TypeEnum.SME]: 'sme',
} as const;

// STRING → ENUM strict map
export const StringToTypeEnumMap = {
  mainboard: TypeEnum.Mainboard,
  sme: TypeEnum.SME,
} as const;

// SAFE STRING LOOKUP
export function getEnumValue(key: string): TypeEnum | undefined {
  return (StringToTypeEnumMap as Record<string, TypeEnum | undefined>)[key.toLowerCase()];
}
