import { EventEmitter } from '../event-emitter';

describe('EventEmitter', () => {
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
  });

  // 测试事件订阅和触发
  test('should subscribe to and emit events', () => {
    const callback = jest.fn();

    eventEmitter.on('test-event', callback);
    eventEmitter.emit('test-event', { data: 'test data' });

    expect(callback).toHaveBeenCalledWith({ data: 'test data' });
  });

  // 测试取消订阅
  test('should unsubscribe from events', () => {
    const callback = jest.fn();

    eventEmitter.on('test-event', callback);
    eventEmitter.off('test-event', callback);
    eventEmitter.emit('test-event', { data: 'test data' });

    expect(callback).not.toHaveBeenCalled();
  });

  // 测试一次性事件
  test('should handle once events', () => {
    const callback = jest.fn();

    eventEmitter.once('test-event', callback);
    eventEmitter.emit('test-event', { data: 'first call' });
    eventEmitter.emit('test-event', { data: 'second call' });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ data: 'first call' });
  });

  // 测试多个订阅者
  test('should handle multiple subscribers', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    eventEmitter.on('test-event', callback1);
    eventEmitter.on('test-event', callback2);
    eventEmitter.emit('test-event', { data: 'test data' });

    expect(callback1).toHaveBeenCalledWith({ data: 'test data' });
    expect(callback2).toHaveBeenCalledWith({ data: 'test data' });
  });
});