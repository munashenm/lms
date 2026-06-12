"use client";

import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  ClipboardCheck,
  FileText,
  CreditCard,
  Megaphone,
  Settings,
  UserCheck,
  BarChart3,
  FolderOpen,
  ClipboardList,
  Award,
  Upload,
  Wallet,
  TrendingDown,
  Palmtree,
  Circle,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/navigation";

const ICON_MAP: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  Users,
  UserCheck,
  GraduationCap,
  BookOpen,
  Calendar,
  ClipboardCheck,
  FileText,
  CreditCard,
  Megaphone,
  Settings,
  BarChart3,
  FolderOpen,
  ClipboardList,
  Award,
  Upload,
  Wallet,
  TrendingDown,
  Palmtree,
};

interface NavIconProps {
  name: NavIconName;
  className?: string;
}

export function NavIcon({ name, className }: NavIconProps) {
  const Icon = ICON_MAP[name] ?? Circle;
  return <Icon className={className} />;
}
