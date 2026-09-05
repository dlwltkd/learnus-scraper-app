// Mock data shown during the app walkthrough tour
// Ensures a consistent experience regardless of the user's actual data
// Dev switch: set true to force mock data without running the walkthrough.
export const FORCE_MOCK_MODE = false;

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

export const TOUR_DEFAULT_MOCK_TRANSCRIPT = `오늘 강의에서는 그래프의 기본 개념과 표현 방법을 정리했어요.
정점과 간선의 정의를 다시 확인하고, 인접 행렬과 인접 리스트의 차이를 비교했어요.
인접 행렬은 구현이 단순하지만 공간 사용량이 크고, 인접 리스트는 희소 그래프에서 효율적이에요.

이어서 그래프 순회 알고리즘으로 DFS와 BFS를 다뤘어요.
DFS는 스택(또는 재귀)을 사용해 깊게 탐색하고, BFS는 큐를 사용해 가까운 정점부터 탐색해요.
각 알고리즘의 시간 복잡도는 O(V + E)라는 점을 예제로 확인했어요.

마지막으로 최단 경로의 직관을 소개하면서, 다음 시간에 다익스트라 알고리즘을 본격적으로 다룰 예정이에요.
실습 과제로는 주어진 그래프에서 BFS 방문 순서를 직접 구해보는 문제가 제공되었어요.`;

export const TOUR_MOCK_TRANSCRIPTS: Record<number, string> = {
    8001: TOUR_DEFAULT_MOCK_TRANSCRIPT,
    8002: `이번 강의는 스택과 큐의 핵심 연산을 중심으로 진행되었어요.
push/pop, enqueue/dequeue의 동작을 코드로 확인했고, 오버플로우/언더플로우 예외 처리도 다뤘어요.

스택 응용으로 괄호 매칭과 후위 표기식 계산을 살펴봤고,
큐 응용으로 작업 스케줄링과 레벨 순회(트리 BFS) 사례를 연결해서 설명했어요.

과제로는 배열 기반 스택과 원형 큐를 각각 구현하고 성능을 비교해보는 연습이 제시되었어요.`,
    8003: `오늘은 마케팅 전략의 기본 프레임워크를 정리했어요.
시장 세분화(Segmentation), 타기팅(Targeting), 포지셔닝(Positioning)의 흐름을 사례로 설명했어요.

특히 타깃 고객 정의가 애매하면 메시지 효율이 급격히 떨어진다는 점을 강조했고,
실무에서는 데이터 기반으로 가설을 세우고 빠르게 검증해야 한다고 안내했어요.

다음 강의에서는 4P 전략을 실제 캠페인 예시와 함께 분석할 예정이에요.`,
};

export const TOUR_DEFAULT_MOCK_SUMMARY = `그래프 기본 개념을 정리하고, 인접 행렬/리스트의 장단점을 비교했어요.

DFS와 BFS의 동작 방식과 시간 복잡도 O(V+E)를 예제로 확인했어요. 다음 시간에는 최단 경로 알고리즘(다익스트라)로 확장할 예정이에요.`;

export const TOUR_MOCK_SUMMARIES: Record<number, string> = {
    8001: TOUR_DEFAULT_MOCK_SUMMARY,
    8002: `스택/큐의 핵심 연산과 예외 처리를 정리했어요.

괄호 매칭, 후위 표기식 계산, 스케줄링 등 대표 응용 사례를 통해 자료구조 선택 기준을 익혔어요.`,
    8003: `STP 프레임워크를 중심으로 마케팅 전략 수립 과정을 다뤘어요.

타깃 정의의 정확도가 메시지 성과를 좌우한다는 점과, 데이터 기반 검증의 중요성을 실제 사례로 설명했어요.`,
};
