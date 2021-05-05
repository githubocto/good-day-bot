import fs from 'fs';
import { createCanvas } from 'canvas';
import { Chart } from 'chart.js';
import * as d3 from 'd3';
import { Octokit } from '@octokit/rest';
import { getDataFromDataFileContents } from './github';
import { sendImageToSlack } from './message';
import { FormResponse, FormResponseField, User } from './types';

const key = process.env.GH_API_KEY;
if (typeof key === 'undefined') {
  throw new Error('need a valid github API key');
}

const octokit = new Octokit({
  auth: key,
});

const getDataForUser = async (user: User) => {
  const owner = user.ghuser || 'githubocto';
  const repo = user.ghrepo || 'good-day-demo';
  const path = 'good-day.csv';

  const response = await octokit.repos.getContent({
    owner,
    repo,
    path,
  });

  const res = response.data;
  const content = 'content' in res ? res.content : '';

  const data = (await getDataFromDataFileContents(content)) as FormResponse[];

  return data;
};

const generateTimelineForField = async (data: FormResponse[], field: FormResponseField) => {
  const width = 1200;
  const height = 350;

  const startDate = new Date(data[0].date);

  const config = {
    type: 'line',
    data: {
      labels: data.map((d) => d3.timeFormat('%A')(new Date(d.date))),
      datasets: [
        {
          label: field,
          borderColor: 'rgb(69, 174, 177)',
          backgroundColor: 'rgba(69, 174, 177, 0.1)',
          pointBackgroundColor: 'rgba(69, 174, 177, 1)',
          pointRadius: 5,
          data: data.map((d) => +d[field]),
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          padding: {
            bottom: 26,
          },
          font: {
            weight: 900,
          },
          text: `${field.replace(/_/g, ' ')} (week of ${d3.timeFormat('%B %-d, %Y')(startDate)})`,
        },
        legend: {
          display: false,
        },
      },
      layout: {
        padding: { top: 30, right: 50, bottom: 30, left: 50 },
      },
      scales: {
        y: {
          min: 0,
          max: 5,
          stepSize: 1,
        },
      },
    },
    plugins: [
      {
        beforeDraw: (chart) => {
          const ctx = chart.canvas.getContext('2d');
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, chart.width, chart.height);
        },
      },
    ],
  };

  const canvas = createCanvas(width, height);

  Chart.defaults.font = {
    family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
    style: 'normal',
    size: 18,
    lineHeight: 1.2,
    weight: '500',
  };

  // @ts-ignore
  const chart = new Chart(canvas, config);

  let imageData = canvas.toDataURL('image/png');
  imageData = imageData.replace(/^data:image\/\w+;base64,/, '');

  await fs.writeFile('/tmp/chart.png', imageData, { encoding: 'base64' }, (e) => {
    console.log(e);
  });

  return imageData;
};

const generateTimeOfDayChart = async (data: FormResponse[]) => {};

const createCharts = async (data: FormResponse[]) => {
  const [date, ...fields] = Object.keys(data[0]).filter(Boolean);
  const fieldTimelines = fields.map((field) => generateTimelineForField(data, field));
  const timeOfDayChart = generateTimeOfDayChart(data);
  return fieldTimelines.join('');
};

const saveImageToRepo = async (imageData: string, user: User) => {
  const owner = user.ghuser || 'githubocto';
  const repo = user.ghrepo || 'good-day-demo';
  const imagePath = 'timeline.png';

  const fileContents = await octokit.repos.getContent({
    owner,
    repo,
    path: imagePath,
  });

  // @ts-ignore
  const sha = fileContents?.data?.sha;

  const response = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: imagePath,
    sha,
    content: imageData,
    message: 'Update summary visualization',
    'committer.name': 'Good Day Bot',
    'committer.email': 'octo-devex+goodday@github.com',
    'author.name': 'Good Day Bot',
    'author.email': 'octo-devex+goodday@github.com',
  });

  const readmeFile = await octokit.repos.getContent({
    owner,
    repo,
    path: 'README.md',
  });

  // @ts-ignore
  const readmeSha = readmeFile?.data?.sha;

  const readmeContents = `
  # Good Day

  Latest summary

  ![Good Day](./timeline.png)
  `;

  const readmeContentsBuffer = Buffer.from(readmeContents);
  const readmeContentsString = readmeContentsBuffer.toString('base64');

  const readmeResponse = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: 'README.md',
    sha: readmeSha,
    content: readmeContentsString,
    message: 'Update README',
    'committer.name': 'Good Day Bot',
    'committer.email': 'octo-devex+goodday@github.com',
    'author.name': 'Good Day Bot',
    'author.email': 'octo-devex+goodday@github.com',
  });
};

const getImageBlock = (text: string, url: string) => [
  {
    type: 'section',
    text: {
      type: 'plain_text',
      text,
      emoji: true,
    },
  },
  {
    type: 'image',
    image_url: url,
    alt_text: 'inspiration',
  },
];

export const createChartsForUser = async (user: User) => {
  const data = await getDataForUser(user);

  const timelineImageData = await createCharts(data);
  if (!timelineImageData) {
    console.log('No data found for ', user.slackid);
    return;
  }
  console.log('timelineImageData', timelineImageData.slice(0, 20));
  await saveImageToRepo(timelineImageData, user);
  await sendImageToSlack(timelineImageData, 'good-day-summary.png', 'Good Day Summary II', user);
};
