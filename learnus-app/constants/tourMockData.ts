// Mock data shown during the app walkthrough tour
// Ensures a consistent experience regardless of the user's actual data

export const TOUR_MOCK_OVERVIEW = {
    stats: {
        completed_assignments_due: 3,
        total_assignments_due: 5,
        missed_vods_count: 1,
        missed_assignments_count: 0,
    },
    missed_assignments: [],
    upcoming_assignments: [
        {
            id: 9001,
            title: '중간 레포트 제출',
            course_name: '경영정보시스템',
            due_date: new Date(Date.now() + 3 * 86400000).toISOString(),
            url: '#',
        },
        {
            id: 9002,
            title: '프로그래밍 과제 #4',
            course_name: '데이터구조',
            due_date: new Date(Date.now() + 5 * 86400000).toISOString(),
            url: '#',
        },
    ],
    available_vods: [
        {
            id: 8001,
            title: '제7주차 - 트리와 그래프',
            course_name: '데이터구조',
            end_date: new Date(Date.now() + 4 * 86400000).toISOString(),
            is_completed: false,
        },
        {
            id: 8002,
            title: '제6주차 - 스택과 큐',
            course_name: '데이터구조',
            end_date: new Date(Date.now() + 2 * 86400000).toISOString(),
            is_completed: true,
        },
        {
            id: 8003,
            title: '제7주차 - 마케팅 전략',
            course_name: '마케팅원론',
            end_date: new Date(Date.now() + 6 * 86400000).toISOString(),
            is_completed: false,
        },
    ],
    missed_vods: [
        {
            id: 8010,
            title: '제5주차 - 연결리스트',
            course_name: '데이터구조',
        },
    ],
    upcoming_vods: [],
    unchecked_vods: [],
};

export const TOUR_MOCK_COURSES = [
    {
        id: 7001,
        name: '데이터구조',
        professor: '김교수',
        is_active: true,
    },
    {
        id: 7002,
        name: '경영정보시스템',
        professor: '이교수',
        is_active: true,
    },
    {
        id: 7003,
        name: '마케팅원론',
        professor: '박교수',
        is_active: true,
    },
    {
        id: 7004,
        name: '선형대수학',
        professor: '최교수',
        is_active: true,
    },
];
