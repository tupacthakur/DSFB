#!/usr/bin/env python3
"""
Instant analysis — Excel-style summary and graphs from CSV/Excel.
Run: python scripts/instant_analysis.py [path/to/file.csv or file.xlsx]
Output: summary stats + graphs (saved to scripts/output/ or shown interactively).
Requires: pip install pandas matplotlib openpyxl
"""

import argparse
import os
import sys
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='Instant analysis: Excel-style stats and graphs from CSV/Excel')
    parser.add_argument('file', nargs='?', help='Path to CSV or Excel file')
    parser.add_argument('-o', '--output-dir', default='scripts/output', help='Directory to save graphs')
    parser.add_argument('--show', action='store_true', help='Show plots interactively instead of saving')
    args = parser.parse_args()

    try:
        import pandas as pd
        import matplotlib
        if not args.show:
            matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except ImportError as e:
        print('Install dependencies: pip install pandas matplotlib openpyxl', file=sys.stderr)
        raise SystemExit(1) from e

    path = args.file
    if not path or not os.path.isfile(path):
        print('Usage: python scripts/instant_analysis.py <file.csv|file.xlsx> [--show]', file=sys.stderr)
        print('Example: python scripts/instant_analysis.py data/sales.csv -o scripts/output', file=sys.stderr)
        raise SystemExit(2)

    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == '.csv':
        df = pd.read_csv(path)
    elif suffix in ('.xlsx', '.xls'):
        df = pd.read_excel(path)
    else:
        print('Supported: .csv, .xlsx, .xls', file=sys.stderr)
        raise SystemExit(3)

    print('Shape:', df.shape)
    print('Columns:', list(df.columns))
    print(df.describe().to_string())

    # Detect numeric and date-like columns
    numeric = df.select_dtypes(include=['number']).columns.tolist()
    date_cols = [c for c in df.columns if df[c].dtype == 'object' and pd.to_datetime(df[c], errors='coerce').notna().any()]
    if not date_cols and 'date' in df.columns:
        date_cols = ['date']

    os.makedirs(args.output_dir, exist_ok=True)
    prefix = path.stem

    # 1) Time series if we have a date column and a value column
    if date_cols and numeric:
        xcol = date_cols[0]
        ycol = numeric[0]
        try:
            df_ts = df.copy()
            df_ts[xcol] = pd.to_datetime(df_ts[xcol], errors='coerce')
            df_ts = df_ts.dropna(subset=[xcol, ycol]).sort_values(xcol)
            if len(df_ts) > 0:
                fig, ax = plt.subplots(figsize=(10, 4))
                ax.fill_between(df_ts[xcol], df_ts[ycol], alpha=0.3)
                ax.plot(df_ts[xcol], df_ts[ycol], linewidth=2)
                ax.set_title(f'{ycol} over time')
                ax.set_ylabel(ycol)
                plt.xticks(rotation=45)
                plt.tight_layout()
                if args.show:
                    plt.show()
                else:
                    out = os.path.join(args.output_dir, f'{prefix}_timeseries.png')
                    plt.savefig(out, dpi=120)
                    print('Saved', out)
                plt.close()
        except Exception as e:
            print('Timeseries plot skip:', e)

    # 2) Bar chart of first numeric column by first categorical (or index)
    if len(numeric) > 0:
        cat_col = None
        for c in df.columns:
            if c not in numeric and df[c].nunique() < 50:
                cat_col = c
                break
        if cat_col is None:
            labels = [str(i) for i in range(min(20, len(df)))]
            val = df[numeric[0]].head(20)
            labels = labels[:len(val)]
        else:
            grp = df.groupby(cat_col)[numeric[0]].sum().sort_values(ascending=False).head(15)
            val = grp
            labels = list(grp.index)
        fig, ax = plt.subplots(figsize=(8, 4))
        ax.barh(range(len(val)), val.values, color='steelblue', alpha=0.8)
        ax.set_yticks(range(len(val)))
        ax.set_yticklabels(labels, fontsize=9)
        ax.set_xlabel(numeric[0])
        ax.set_title(f'{numeric[0]} by category')
        plt.tight_layout()
        if args.show:
            plt.show()
        else:
            out = os.path.join(args.output_dir, f'{prefix}_bars.png')
            plt.savefig(out, dpi=120)
            print('Saved', out)
        plt.close()

    # 3) Distribution of first numeric column
    if numeric:
        fig, ax = plt.subplots(figsize=(6, 3))
        ax.hist(df[numeric[0]].dropna(), bins=min(30, max(5, len(df) // 10)), color='steelblue', edgecolor='white', alpha=0.8)
        ax.set_xlabel(numeric[0])
        ax.set_ylabel('Count')
        ax.set_title(f'Distribution of {numeric[0]}')
        plt.tight_layout()
        if args.show:
            plt.show()
        else:
            out = os.path.join(args.output_dir, f'{prefix}_dist.png')
            plt.savefig(out, dpi=120)
            print('Saved', out)
        plt.close()

    print('Done.')

if __name__ == '__main__':
    main()
