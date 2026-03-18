export type VoiceOption = {
  id: string;
  label: string;
  locale: string;
};

export type VoiceGroup = {
  id: string;
  label: string;
  voices: VoiceOption[];
};

const VOICE_GROUPS: VoiceGroup[] = [
  {
    id: "zh-cn",
    label: "Mandarin (zh-CN)",
    voices: [
      { id: "zh-CN-XiaoxiaoNeural", label: "Xiaoxiao", locale: "zh-CN" },
      { id: "zh-CN-YunxiNeural", label: "Yunxi", locale: "zh-CN" },
      { id: "zh-CN-YunjianNeural", label: "Yunjian", locale: "zh-CN" },
    ],
  },
  {
    id: "en-us",
    label: "English (US)",
    voices: [
      { id: "en-US-JennyNeural", label: "Jenny", locale: "en-US" },
      { id: "en-US-GuyNeural", label: "Guy", locale: "en-US" },
      { id: "en-US-AriaNeural", label: "Aria", locale: "en-US" },
    ],
  },
];

export function getVoiceGroups() {
  return VOICE_GROUPS;
}
