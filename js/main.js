import { initThemeToggle } from './theme-toggle.js';
import { initChart } from './chart.js';

const toggle = document.querySelector('[data-theme-toggle]');
if (toggle) initThemeToggle(toggle);

const chartFrame = document.querySelector('[data-chart]');
const storyList = document.getElementById('story-list');
if (chartFrame && storyList) {
  try {
    initChart(chartFrame, storyList);
  } catch (error) {
    console.error('Career chart could not be drawn; the story section still lists every milestone.', error);
    chartFrame.hidden = true;
  }
}
