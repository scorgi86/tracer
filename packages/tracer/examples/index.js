import { Tracer } from '../src/index.js';
// ========== 1. Базовый пример: отслеживание API клиента ==========

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cache = new Map();
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    
    // Проверяем кэш
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    // Сохраняем в кэш
    this.cache.set(cacheKey, data);
    
    return data;
  }
  
  async getUsers() {
    return this.request('/users');
  }
  
  async getUser(id) {
    return this.request(`/users/${id}`);
  }
}

// Оборачиваем класс для трассировки
const TracedApiClient = Tracer.observeConstructor(ApiClient, 'ApiClient');

// Создаем экземпляр
const api = new TracedApiClient('https://jsonplaceholder.typicode.com');

// Настраиваем слайсы для разных типов операций
Tracer.defineSlice('apiRequests', {
  predicate: (args) => args.className === 'ApiClient' && args.fnKey === 'request',
  beforeCall: () => true,
  afterCall: () => false,
  description: 'Отслеживание API запросов'
});

Tracer.defineSlice('cacheOperations', {
  predicate: (args) => args.className === 'ApiClient' && 
                       (args.fnKey === 'get' || args.fnKey === 'set'),
  beforeCall: () => true,
  afterCall: () => false,
  description: 'Отслеживание кэширования'
});

// Подписываемся на события
Tracer.traceBySlice('apiRequests', (event) => {
  if (event.place === 'before') {
    console.log(`📡 Запрос: ${event.args[0]}`);
  } else {
    console.log(`✅ Ответ получен, статус: ${event.value?.status || 'OK'}`);
  }
});

Tracer.traceBySlice('cacheOperations', (event) => {
  if (event.fnKey === 'get') {
    console.log(`💾 Чтение из кэша: ${event.args[0]}`);
  } else if (event.fnKey === 'set') {
    console.log(`💾 Сохранение в кэш: ${event.args[0]}`);
  }
});

// Выполняем запросы
await api.getUsers();
await api.getUser(1);

// ========== 2. Пример с отладкой производительности ==========

class DataProcessor {
  processLargeArray(data) {
    let result = 0;
    for (let i = 0; i < data.length; i++) {
      result += data[i];
    }
    return result;
  }
  
  async processAsyncData(data) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(data.map(x => x * 2));
      }, 1000);
    });
  }
}

const TracedProcessor = Tracer.observeConstructor(DataProcessor, 'DataProcessor');
const processor = new TracedProcessor();

// Создаем слайс для измерения производительности
Tracer.defineSlice('performance', (args) => 
  args.fnKey === 'processLargeArray' || args.fnKey === 'processAsyncData'
);

// Измеряем время выполнения
const timings = new Map();

Tracer.traceBySlice('performance', (event) => {
  if (event.place === 'before') {
    timings.set(event.fullName, Date.now());
  } else {
    const duration = Date.now() - timings.get(event.fullName);
    console.log(`⏱️ ${event.fullName} выполнился за ${duration}ms`);
    
    // Отправляем метрики если время превышает порог
    if (duration > 500) {
      console.warn(`⚠️ Медленная операция: ${event.fullName} (${duration}ms)`);
    }
  }
});

// Выполняем операции
const largeArray = Array(1000000).fill().map(() => Math.random());
processor.processLargeArray(largeArray);
await processor.processAsyncData([1, 2, 3]);

// ========== 3. Пример с условной трассировкой ==========

class UserService {
  constructor() {
    this.users = new Map();
  }
  
  createUser(userData) {
    if (!userData.email) {
      throw new Error('Email is required');
    }
    
    const id = Date.now();
    const user = { id, ...userData, createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }
  
  deleteUser(id) {
    if (!this.users.has(id)) {
      throw new Error('User not found');
    }
    this.users.delete(id);
    return true;
  }
  
  async sendNotification() {
    // Имитация отправки уведомления
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }
}

const TracedUserService = Tracer.observeConstructor(UserService, 'UserService');
const userService = new TracedUserService();

// Слайс для отслеживания ошибок
Tracer.defineSlice('errors', {
  predicate: (args) => {
    // Отслеживаем только операции, которые могут вызвать ошибки
    return ['createUser', 'deleteUser'].includes(args.fnKey);
  },
  beforeCall: () => true,
  afterCall: () => false
});

// Отслеживаем только ошибочные операции
Tracer.traceBySlice('errors', (event) => {
  if (event.place === 'after' && event.value instanceof Error) {
    console.error(`❌ Ошибка в ${event.fullName}:`, event.value.message);
    console.error('Стек вызовов:', event.callStack);
  }
});

// Тестируем
try {
  userService.createUser({ name: 'John' }); // Ошибка: email required
} catch (e) {
  // Ошибка будет перехвачена трассировкой
}

try {
  userService.deleteUser(999); // Ошибка: user not found
} catch (_) {
  // Ошибка будет перехвачена трассировкой
}

// ========== 4. Пример с комплексным анализом ==========

// Создаем несколько слайсов для разных аспектов
Tracer.defineSlice('database', {
  predicate: (args) => args.className === 'Database',
  beforeCall: () => true,
  afterCall: () => false,
  description: 'Все операции с базой данных'
});

Tracer.defineSlice('authentication', {
  predicate: (args) => args.className === 'AuthService',
  beforeCall: () => true,
  afterCall: () => false,
  description: 'Аутентификация пользователей'
});

Tracer.defineSlice('businessLogic', {
  predicate: (args) => ['OrderService', 'PaymentService'].includes(args.className),
  beforeCall: () => true,
  afterCall: () => false,
  description: 'Бизнес-логика'
});

// Анализируем последовательность операций
Tracer.traceBySliceSequence(['authentication', 'database'], (event) => {
  console.log('🔐 Аутентифицированный запрос к БД:', event.fullName);
});

// Собираем статистику
const stats = {
  database: 0,
  auth: 0,
  business: 0
};

Tracer.traceCalls((event) => {
  if (event.eventType === 'functionCall' && event.place === 'before') {
    if (event.className === 'Database') stats.database++;
    if (event.className === 'AuthService') stats.auth++;
    if (['OrderService', 'PaymentService'].includes(event.className)) stats.business++;
  }
});

// Периодически выводим статистику
setInterval(() => {
  console.log('📊 Статистика вызовов:', stats);
}, 60000);

// ========== 5. Пример с отладкой в production ==========

// Включаем отладку только для определенных пользователей
const isDebugUser = (userId) => {
  return userId === 'admin-123'; // Только для админа
};

// Создаем слайс для отладки
Tracer.defineSlice('debugMode', {
  predicate: (args) => {
    // Проверяем, есть ли ID пользователя в аргументах
    const userId = args.args?.[0]?.userId;
    return userId && isDebugUser(userId);
  },
  beforeCall: () => true,
  afterCall: () => false,
  initial: false
});

// Подключаем детальное логирование для отладочных пользователей
Tracer.traceBySlice('debugMode', (event) => {
  console.group(`🐛 [DEBUG] ${event.fullName}`);
  console.log('Аргументы:', event.args);
  console.log('Контекст:', event.callStack);
  if (event.place === 'after') {
    console.log('Результат:', event.value);
  }
  console.groupEnd();
});

// Использование
function processUserRequest(userId, action) {
  Tracer.invokeOnSlice('debugMode', () => {
    console.log(`👤 Обработка запроса для пользователя ${userId}`);
  });
  
  // ... бизнес-логика
}

processUserRequest('admin-123', 'getData'); // Будет детальное логирование
processUserRequest('user-456', 'getData');  // Обычное выполнение
