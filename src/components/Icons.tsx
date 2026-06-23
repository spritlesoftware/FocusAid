import React from 'react';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { COLORS } from '../config/colors';

interface IconProps {
  size?: number;
  color?: string;
  style?: any;
}

// 1. Microphone Icon
export function MicIcon({ size = 32, color = COLORS.secondary, style }: IconProps) {
  return <FeatherIcon name="mic" size={size} color={color} style={style} />;
}

// 2. Clock/History Icon
export function ClockIcon({ size = 20, color = COLORS.primary, style }: IconProps) {
  return <FeatherIcon name="clock" size={size} color={color} style={style} />;
}

// 3. Gear/Settings Icon
export function GearIcon({ size = 20, color = COLORS.primary, style }: IconProps) {
  return <FeatherIcon name="settings" size={size} color={color} style={style} />;
}

// 4. Key Icon
export function KeyIcon({ size = 18, color = COLORS.primary, style }: IconProps) {
  return <FeatherIcon name="key" size={size} color={color} style={style} />;
}

// 5. Speech Bubble / Message Square Icon
export function MessageSquareIcon({ size = 18, color = COLORS.secondary, style }: IconProps) {
  return <FeatherIcon name="message-square" size={size} color={color} style={style} />;
}

// 6. List Icon
export function ListIcon({ size = 18, color = '#4B5563', style }: IconProps) {
  return <FeatherIcon name="list" size={size} color={color} style={style} />;
}

// 7. Trash / Bin Icon
export function TrashIcon({ size = 18, color = '#EF4444', style }: IconProps) {
  return <FeatherIcon name="trash-2" size={size} color={color} style={style} />;
}

// 8. Chevron Up Icon
export function ChevronUpIcon({ size = 10, color = COLORS.primary, style }: IconProps) {
  return <FeatherIcon name="chevron-up" size={size} color={color} style={style} />;
}

// 9. Chevron Down Icon
export function ChevronDownIcon({ size = 10, color = COLORS.primary, style }: IconProps) {
  return <FeatherIcon name="chevron-down" size={size} color={color} style={style} />;
}

// 10. Stop Icon
export function StopIcon({ size = 12, color = '#FFF', style }: IconProps) {
  return <FeatherIcon name="square" size={size} color={color} style={style} />;
}

// 11. Play Icon
export function PlayIcon({ size = 12, color = '#FFF', style }: IconProps) {
  return <FeatherIcon name="play" size={size} color={color} style={style} />;
}
