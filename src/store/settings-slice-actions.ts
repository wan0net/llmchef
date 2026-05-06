import type { SettingsState } from "@/types/llmchef/settings";

type SettingsStoreSetState = (partial: Partial<SettingsState>) => void;

type SliceSettingActionFactoryOptions<Slice extends Partial<SettingsState>> = {
  setState: SettingsStoreSetState;
  persist: (partial: Partial<Slice>) => Promise<void>;
  persistStateSlice: (
    partial: Partial<SettingsState>,
    persist: () => Promise<void>,
  ) => void;
};

export const createSettingsSliceActionFactory = <
  Slice extends Partial<SettingsState>,
>({
  setState,
  persist,
  persistStateSlice,
}: SliceSettingActionFactoryOptions<Slice>) => {
  return <K extends keyof Slice & keyof SettingsState>(
    key: K,
    emit: (value: Slice[K]) => void,
    normalize?: (value: Slice[K]) => Slice[K],
  ) => {
    return (value: Slice[K]) => {
      const nextValue = normalize ? normalize(value) : value;
      const partial = { [key]: nextValue } as Pick<SettingsState, K>;

      setState(partial);
      persistStateSlice(partial, () =>
        persist({ [key]: nextValue } as Partial<Slice>),
      );
      emit(nextValue);
    };
  };
};
