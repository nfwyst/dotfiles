#!/usr/bin/env python3
import csv
import sys
import math
import argparse
from statistics import mean, stdev

def analyze_csv(file_path, window_size=10):
    steps = []
    scalars = []
    
    try:
        with open(file_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    steps.append(float(row['step']))
                    scalars.append(float(row['scalar']))
                except ValueError:
                    continue
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    if not scalars:
        print("No valid data found in CSV.")
        return

    total_points = len(scalars)
    print(f"Total data points: {total_points}")
    print(f"Latest value (Step {int(steps[-1])}): {scalars[-1]}")

    if total_points < 2:
        print("Not enough data for trend analysis.")
        return
        
    # Key Statistics
    min_val = min(scalars)
    max_val = max(scalars)
    avg_val = mean(scalars)
    min_step = steps[scalars.index(min_val)]
    max_step = steps[scalars.index(max_val)]

    print(f"Min value: {min_val} (at Step {int(min_step)})")
    print(f"Max value: {max_val} (at Step {int(max_step)})")
    print(f"Average value: {avg_val:.4f}")

    # Analyze recent trend
    recent_window = min(window_size, total_points)
    recent_data = scalars[-recent_window:]
    recent_mean = mean(recent_data)
    
    if total_points > recent_window:
        prev_window_data = scalars[-2*recent_window:-recent_window]
        prev_mean = mean(prev_window_data)
        change = recent_mean - prev_mean
        percent_change = (change / prev_mean) * 100 if prev_mean != 0 else 0
        
        trend = "STABLE"
        if percent_change > 1:
            trend = "INCREASING"
        elif percent_change < -1:
            trend = "DECREASING"
            
        print(f"Trend (last {recent_window} vs prev {recent_window}): {trend} ({percent_change:.2f}%)")
    
    # Volatility (Standard Deviation of recent window)
    if len(recent_data) > 1:
        volatility = stdev(recent_data)
        print(f"Recent Volatility (StdDev): {volatility:.4f}")
        
        # Simple anomaly detection: check if last point is far from mean
        z_score = (scalars[-1] - recent_mean) / volatility if volatility != 0 else 0
        if abs(z_score) > 3:
            print(f"WARNING: Potential Anomaly Detected! Last point is {z_score:.2f} std devs from recent mean.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze tracking metrics CSV.")
    parser.add_argument("file", help="Path to the CSV file")
    parser.add_argument("--window", type=int, default=20, help="Window size for trend analysis")
    
    args = parser.parse_args()
    analyze_csv(args.file, args.window)
