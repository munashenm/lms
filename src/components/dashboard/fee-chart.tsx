"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FeeChartProps {
  data: { month: string; collected: number; outstanding: number }[];
}

export function FeeChart({ data }: FeeChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fee Collection (ZAR)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94A3B8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
            <Tooltip
              formatter={(value) => [`R ${Number(value).toLocaleString("en-ZA")}`, ""]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                fontSize: "13px",
              }}
            />
            <Bar dataKey="collected" fill="#1B4D6E" radius={[4, 4, 0, 0]} name="Collected" />
            <Bar dataKey="outstanding" fill="#E8A317" radius={[4, 4, 0, 0]} name="Outstanding" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
