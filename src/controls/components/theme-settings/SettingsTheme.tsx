// src/components/LLMChef/settings/SettingsTheme.tsx
// FULL FILE
import React, { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcwIcon } from "lucide-react";
import { SliderField } from "@/components/LLMChef/common/form-fields/SliderField";
import { TextField } from "@/components/LLMChef/common/form-fields/TextField";
import { SelectField } from "@/components/LLMChef/common/form-fields/SelectField";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Separator } from "@/components/ui/separator";
import { SettingsSection } from "@/components/LLMChef/common/SettingsSection";
import type { CustomThemeColors } from "@/types/llmchef/settings";
import { THEME_OPTIONS, type Theme } from "@/types/llmchef/common";

const ColorInput: React.FC<{
  label: string;
  colorKey: keyof CustomThemeColors;
  value: string | undefined | null;
  onChange: (key: keyof CustomThemeColors, value: string | null) => void;
}> = ({ label, colorKey, value, onChange }) => {
  const [localValue, setLocalValue] = useState(value ?? "");

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const handleBlur = () => {
    onChange(colorKey, localValue.trim() || null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={`color-${colorKey}`} className="text-xs w-28 shrink-0">
        {label}
      </Label>
      <Input
        id={`color-${colorKey}`}
        type="text"
        value={localValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="h-8 text-xs flex-grow"
        placeholder="e.g., #ffffff or oklch(0.5 0.2 180)"
      />
      <Input
        type="color"
        value={localValue?.startsWith("#") ? localValue : "#000000"}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(colorKey, e.target.value);
        }}
        className="h-8 w-10 p-1 border-none cursor-pointer bg-transparent"
        aria-label={`Pick ${label} color`}
      />
    </div>
  );
};

const PRISM_THEMES = [
  {
    label: "Default local theme",
    value: "",
  },
];

const themeEnum = z.enum(THEME_OPTIONS as [Theme, ...Theme[]]);
const themeSettingsSchema = z.object({
  theme: themeEnum,
  prismThemeUrl: z.string(),
  customFontFamily: z.string(),
  customFontSize: z.number().min(12).max(20),
  chatMaxWidth: z.string(),
  customThemeColors: z.record(z.string(), z.string().nullable()),
});

const SettingsThemeComponent: React.FC = () => {
  const storeSetters = useSettingsStore(
    useShallow((state) => ({
      setTheme: state.setTheme,
      setPrismThemeUrl: state.setPrismThemeUrl,
      setCustomFontFamily: state.setCustomFontFamily,
      setCustomFontSize: state.setCustomFontSize,
      setChatMaxWidth: state.setChatMaxWidth,
      setCustomThemeColor: state.setCustomThemeColor,
      resetThemeSettings: state.resetThemeSettings,
    }))
  );
  const storeValues = useSettingsStore(
    useShallow((state) => ({
      theme: state.theme,
      prismThemeUrl: state.prismThemeUrl,
      customFontFamily: state.customFontFamily,
      customFontSize: state.customFontSize,
      chatMaxWidth: state.chatMaxWidth,
      _rawCustomThemeColors: state.customThemeColors,
      enableAdvancedSettings: state.enableAdvancedSettings,
    }))
  );

  const form = useForm({
    defaultValues: {
      theme: storeValues.theme ?? "system",
      prismThemeUrl: storeValues.prismThemeUrl ?? "",
      customFontFamily: storeValues.customFontFamily ?? "",
      customFontSize: storeValues.customFontSize ?? 16,
      chatMaxWidth: storeValues.chatMaxWidth ?? "max-w-7xl",
      customThemeColors: storeValues._rawCustomThemeColors ?? {},
    },
    onSubmit: async ({ value }) => {
      storeSetters.setTheme(value.theme);
      storeSetters.setPrismThemeUrl(value.prismThemeUrl || null);
      storeSetters.setCustomFontFamily(value.customFontFamily);
      storeSetters.setCustomFontSize(value.customFontSize);
      storeSetters.setChatMaxWidth(value.chatMaxWidth);
      // Update all customThemeColors keys
      if (value.customThemeColors) {
        Object.entries(value.customThemeColors).forEach(([k, v]) => {
          storeSetters.setCustomThemeColor(
            k as keyof typeof value.customThemeColors,
            v
          );
        });
      }
    },
    validators: {
      onChangeAsync: themeSettingsSchema,
      onChangeAsyncDebounceMs: 300,
    },
  });

  useEffect(() => {
    form.reset({
      theme: storeValues.theme ?? "system",
      prismThemeUrl: storeValues.prismThemeUrl ?? "",
      customFontFamily: storeValues.customFontFamily ?? "",
      customFontSize: storeValues.customFontSize ?? 16,
      chatMaxWidth: storeValues.chatMaxWidth ?? "max-w-7xl",
      customThemeColors: storeValues._rawCustomThemeColors ?? {},
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    storeValues.theme,
    storeValues.prismThemeUrl,
    storeValues.customFontFamily,
    storeValues.customFontSize,
    storeValues.chatMaxWidth,
    storeValues._rawCustomThemeColors,
  ]);

  const handleResetClick = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all Theme settings to their defaults?"
      )
    ) {
      storeSetters.resetThemeSettings();
    }
  };

  const maxWidthOptions: { value: string; label: string }[] = [
    { value: "max-w-3xl", label: "Very Small" },
    { value: "max-w-4xl", label: "Small" },
    { value: "max-w-5xl", label: "Medium" },
    { value: "max-w-6xl", label: "Large" },
    { value: "max-w-7xl", label: "Very Large" },
    { value: "max-w-full", label: "Full Width" },
  ];

  const colorKeys: { key: keyof CustomThemeColors; label: string }[] = [
    { key: "background", label: "Background" },
    { key: "foreground", label: "Foreground" },
    { key: "card", label: "Card BG" },
    { key: "cardForeground", label: "Card FG" },
    { key: "popover", label: "Popover BG" },
    { key: "popoverForeground", label: "Popover FG" },
    { key: "primary", label: "Primary" },
    { key: "primaryForeground", label: "Primary FG" },
    { key: "secondary", label: "Secondary" },
    { key: "secondaryForeground", label: "Secondary FG" },
    { key: "muted", label: "Muted BG" },
    { key: "mutedForeground", label: "Muted FG" },
    { key: "accent", label: "Accent" },
    { key: "accentForeground", label: "Accent FG" },
    { key: "destructive", label: "Destructive" },
    { key: "destructiveForeground", label: "Destructive FG" },
    { key: "border", label: "Border" },
    { key: "input", label: "Input BG" },
    { key: "ring", label: "Ring (Focus)" },
    { key: "sidebar", label: "Sidebar BG" },
    { key: "sidebarForeground", label: "Sidebar FG" },
    { key: "sidebarPrimary", label: "Sidebar Primary" },
    { key: "sidebarPrimaryForeground", label: "Sidebar Primary FG" },
    { key: "sidebarAccent", label: "Sidebar Accent" },
    { key: "sidebarAccentForeground", label: "Sidebar Accent FG" },
    { key: "sidebarBorder", label: "Sidebar Border" },
    { key: "sidebarRing", label: "Sidebar Ring" },
    { key: "chart1", label: "Chart 1" },
    { key: "chart2", label: "Chart 2" },
    { key: "chart3", label: "Chart 3" },
    { key: "chart4", label: "Chart 4" },
    { key: "chart5", label: "Chart 5" },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4 p-1"
    >
      {/* Base Theme Selection */}
      <SettingsSection
        title="Base Theme"
        description="Select the overall look and feel."
        contentClassName="rounded-lg border p-3 shadow-sm bg-card"
      >
        <div className="flex items-center justify-between">
          <Label htmlFor="theme-select" className="font-medium">
            Theme
          </Label>
          <SelectField
            form={form}
            name="theme"
            label="Theme"
            options={THEME_OPTIONS.map((theme) => {
              switch (theme) {
                case "light":
                  return { value: "light", label: "Link42 Light" };
                case "dark":
                  return { value: "dark", label: "Link42 Dark" };
                case "link42Light":
                  return { value: "link42Light", label: "Link42 Light (explicit)" };
                case "link42Dark":
                  return { value: "link42Dark", label: "Link42 Dark (explicit)" };
                case "TijuLight":
                  return { value: "TijuLight", label: "Tiju Light" };
                case "TijuDark":
                  return { value: "TijuDark", label: "Tiju Dark" };
                case "custom":
                  return { value: "custom", label: "User Custom" };
                default:
                  return { value: theme, label: theme };
              }
            })}
            triggerClassName="w-[180px]"
          />
        </div>
      </SettingsSection>

      {/* Font & Layout */}
      <SettingsSection
        title="Font & Layout"
        description="Customize typography and content width."
        contentClassName="rounded-lg border p-3 shadow-sm bg-card space-y-3"
      >
        <div>
          <TextField
            form={form}
            name="customFontFamily"
            label="Custom Font Family"
            placeholder="e.g., 'Inter', sans-serif (Leave blank for default)"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Applies only when 'User Custom' theme is selected. Ensure the font
            is available (system or web font).
          </p>
        </div>
        <div className="space-y-1.5">
          <SliderField
            form={form}
            name="customFontSize"
            label={`Base Font Size (${form.getFieldValue("customFontSize")}px)`}
            min={12}
            max={20}
            step={1}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground">
            Applies only when 'User Custom' theme is selected. Affects base text
            size (Default: 16px).
          </p>
        </div>
        <div>
          <SelectField
            form={form}
            name="chatMaxWidth"
            label="Chat Content Max Width"
            options={maxWidthOptions}
            triggerClassName="w-full mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Controls the maximum width of the main chat message area.
          </p>
        </div>
      </SettingsSection>

      {/* Code Block Theme */}
      {storeValues.enableAdvancedSettings && (
        <SettingsSection
          title="Code Block Theme"
          description="Customize syntax highlighting appearance."
          contentClassName="rounded-lg border p-3 shadow-sm bg-card space-y-3"
        >
          <SelectField
            form={form}
            name="prismThemeUrl"
            label="Code Block Theme"
            options={PRISM_THEMES}
            triggerClassName="w-full"
          />
          <TextField
            form={form}
            name="prismThemeUrl"
            label="Local stylesheet path"
            placeholder="/themes/prism.css"
            type="text"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use a same-origin stylesheet path. External theme URLs are ignored
            so code highlighting stays local after the app loads.
          </p>
        </SettingsSection>
      )}

      {/* Custom Theme Colors, only display if selected theme is custom */}
      {form.getFieldValue("theme") === "custom" && (
        <SettingsSection
          title="Custom Theme Colors"
          description="Define custom colors. Use valid CSS color values (hex, rgb, oklch, etc.). Leave blank to use default light/dark theme colors."
          contentClassName="rounded-lg border p-3 shadow-sm bg-card"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
            {colorKeys.map(({ key, label }) => (
              <ColorInput
                key={key}
                label={label}
                colorKey={key}
                value={form.getFieldValue("customThemeColors")?.[key]}
                onChange={(k, v) =>
                  form.setFieldValue(
                    `customThemeColors.${k}`,
                    v === null ? "" : v
                  )
                }
              />
            ))}
          </div>
        </SettingsSection>
      )}

      {/* Submit and Reset Buttons */}
      <Separator />
      <div className="flex justify-between pt-3">
        <Button variant="outline" size="sm" onClick={handleResetClick} type="button">
          <RotateCcwIcon className="mr-2 h-4 w-4" />
          Reset Theme Settings
        </Button>
        <Button
          type="submit"
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Apply Theme Settings
        </Button>
      </div>
    </form>
  );
};

export const SettingsTheme = React.memo(SettingsThemeComponent);
