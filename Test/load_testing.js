import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

export const options = {
    stages: [
        { duration: '30s', target: 20 },  // Ramp up to 20 users
        { duration: '1m', target: 20 },   // Stay at 20 users
        { duration: '30s', target: 50 }, // Increase to 50 users
        { duration: '2m', target: 50 },  // Stay at 50 users
        { duration: '1m', target: 70 }, // Increase to 70 users
        { duration: '30s', target: 70 }, // Stay at 70 users
        { duration: '1m', target: 0 }    // Ramp down to 0 users
    ],

    thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
    },
};

const BASE_URL = 'https://www.ahzassociates.com/';

export default function () {
    const response = http.get(`${BASE_URL}`);

    check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
}

export function handleSummary(data) {
    return {
        'summary.html': htmlReport(data),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}