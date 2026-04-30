// src/controls/components/data-settings/SettingsDataTabbed.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { TabbedLayout } from "@/components/LiteChat/common/TabbedLayout";
import { SettingsDataManagement } from "./SettingsDataManagement";
import { SettingsConfigSync } from "../config-sync-settings/SettingsConfigSync";
import { SettingsCrea8Memory } from "./SettingsCrea8Memory";

const SettingsDataTabbedComponent: React.FC = () => {
  const { t } = useTranslation('settings');

  const tabs = [
    {
      value: "import-export",
      label: t('dataManagement.tabs.importExport'),
      content: <SettingsDataManagement />,
      order: 1,
    },
    {
      value: "config-sync", 
      label: t('dataManagement.tabs.configSync'),
      content: <SettingsConfigSync />,
      order: 2,
    },
    {
      value: "crea8-memory",
      label: "crea8 Memory",
      content: <SettingsCrea8Memory />,
      order: 3,
    },
  ];

  return (
    <TabbedLayout
      tabs={tabs.sort((a, b) => (a.order || 0) - (b.order || 0))}
      defaultValue="import-export"
      scrollable={true}
    />
  );
};

export const SettingsDataTabbed = SettingsDataTabbedComponent;
