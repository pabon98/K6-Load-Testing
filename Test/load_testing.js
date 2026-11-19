import http from 'k6/http';
import { check, group, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Custom metrics that appear in both the Console Summary and summary.html
const failedByStage = new Counter('failed_requests_by_vu_load');
const activeVUsAtLastFailure = new Gauge('active_vus_at_failure');

export const options = {
    stages: [
        { duration: '30s', target: 20 },  // Ramp up to 20 users
        { duration: '30s', target: 20 },  // Stay at 20 users
        { duration: '30s', target: 50 },  // Increase to 50 users
        { duration: '30s', target: 50 },  // Stay at 50 users
        { duration: '30s', target: 70 },  // Increase to 70 users
        { duration: '30s', target: 70 },  // Stay at 70 users
        { duration: '30s', target: 90 },  // Increase to 90 users
        { duration: '30s', target: 90 },  // Stay at 90 users
        { duration: '30s', target: 0 },   // Ramp down to 0 users
    ],

    thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
    },
};

const PAGES = [
    { name: '01_Home', url: 'https://www.ahzassociates.com/' },
    { name: '02_Universities', url: 'https://www.ahzassociates.com/universities' },
    { name: '03_Courses', url: 'https://www.ahzassociates.com/courses' },
    { name: '04_Global_Offices', url: 'https://www.ahzassociates.com/global-offices' },
    { name: '05_Contact_Us', url: 'https://www.ahzassociates.com/contact-us' },
    { name: '06_Events', url: 'https://www.ahzassociates.com/events' },
    { name: '07_News', url: 'https://www.ahzassociates.com/news' },
    { name: '08_Blogs', url: 'https://www.ahzassociates.com/blogs' },
];

// Helper to group active VUs into clear load brackets for the report
function getVUBracket(activeVUs) {
    if (activeVUs <= 20) return '01_1_to_20_VUs';
    if (activeVUs <= 50) return '02_21_to_50_VUs';
    if (activeVUs <= 70) return '03_51_to_70_VUs';
    return '04_71_to_90_VUs';
}

export default function () {
    for (const page of PAGES) {
        group(page.name, function () {
            const activeVUs = exec.instance.vusActive;
            const vuBracket = getVUBracket(activeVUs);

            const response = http.get(page.url, {
                tags: { page: page.name, vu_load: vuBracket },
            });

            const isSuccess = response.status === 200;

            // Log exact failure details to the console the moment any request fails
            if (!isSuccess) {
                console.error(
                    `[FAILED] Active VUs: ${activeVUs} | VU ID: #${__VU} | Bracket: ${vuBracket} | Page: ${page.name} | Status: ${response.status} | Duration: ${response.timings.duration.toFixed(0)}ms`
                );
                failedByStage.add(1, { vu_load: vuBracket, page: page.name });
                activeVUsAtLastFailure.add(activeVUs);
            }

            check(response, {
                [`${page.name} - status is 200`]: (r) => r.status === 200,
                [`${page.name} - response time < 500ms`]: (r) => r.timings.duration < 500,
                [`Load [${vuBracket}] - status is 200`]: (r) => r.status === 200,
            });
        });

        sleep(1);
    }
}

export function handleSummary(data) {
    return {
        'summary.html': htmlReport(data),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}