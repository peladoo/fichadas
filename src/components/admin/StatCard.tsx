"use client";

import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string | number;
  bgClassName?: string;
  onClick?: () => void;
}

export default function StatCard({
  icon: Icon,
  iconClassName = "w-8 h-8 text-[#b6c544]",
  label,
  value,
  bgClassName = "bg-[#f0f9e6] dark:bg-gray-700",
  onClick,
}: StatCardProps) {
  const content = (
    <div className="flex items-center gap-3">
      <Icon className={iconClassName} />
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${bgClassName} p-4 rounded-lg text-left w-full transition hover:shadow-md`}
      >
        {content}
      </button>
    );
  }

  return <div className={`${bgClassName} p-4 rounded-lg`}>{content}</div>;
}
