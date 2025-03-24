import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule, ChartModule],
  template: `
    <div class="bg-white rounded-md shadow-sm p-4 h-full">
      <h4 class="text-lg font-semibold mb-4">{{ title }}</h4>
      <p-chart
        [type]="type"
        [data]="chartData"
        [options]="chartOptions"
        height="250px"
      ></p-chart>
    </div>
  `,
})
export class ChartCardComponent implements OnChanges {
  @Input() title = '';
  @Input() type:
    | 'line'
    | 'bar'
    | 'pie'
    | 'scatter'
    | 'bubble'
    | 'doughnut'
    | 'polarArea'
    | 'radar'
    | undefined = 'bar';
  @Input() data: any[] = [];
  @Input() labels: string[] = [];
  @Input() datasetLabel: string = '';
  @Input() backgroundColor: string | string[] = '#42A5F5';
  @Input() borderColor: string | string[] = '#42A5F5';
  @Input() yAxisLabel: string = '';
  @Input() xAxisLabel: string = '';

  chartData: any;
  chartOptions: any;

  constructor() {
    this.initChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['labels']) {
      this.initChart();
    }
  }

  private initChart() {
    this.chartData = {
      labels: this.labels,
      datasets: [
        {
          label: this.datasetLabel,
          data: this.data,
          backgroundColor: this.backgroundColor,
          borderColor: this.borderColor,
          borderWidth: 1,
        },
      ],
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: !!this.yAxisLabel,
            text: this.yAxisLabel,
          },
        },
        x: {
          title: {
            display: !!this.xAxisLabel,
            text: this.xAxisLabel,
          },
        },
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
      },
    };
  }
}
