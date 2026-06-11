"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EnrollmentChartProps {
  data: { month: string; students: number }[];
}

export function EnrollmentChart({ data }: EnrollmentChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Student Enrolment Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1B4D6E" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#1B4D6E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94A3B8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                fontSize: "13px",
              }}
            />
            <Area
              type="monotone"
              dataKey="students"
              stroke="#1B4D6E"
              strokeWidth={2}
              fill="url(#enrollGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
