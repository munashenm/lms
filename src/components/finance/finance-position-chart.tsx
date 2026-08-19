"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FinancePositionChart(props: {
  data: Array<{ month: string; income: number; expenses: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Income vs expenses (ZAR)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={props.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94A3B8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
            <Tooltip
              formatter={(value) => [`R ${Number(value).toLocaleString("en-ZA")}`, ""]}
              contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px" }}
            />
            <Legend />
            <Bar dataKey="income" fill="#1B4D6E" radius={[4, 4, 0, 0]} name="Income" />
            <Bar dataKey="expenses" fill="#E8A317" radius={[4, 4, 0, 0]} name="Expenses" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
