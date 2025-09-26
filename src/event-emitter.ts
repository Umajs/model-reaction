// 事件发射器类
export class EventEmitter {
    private events: Record<string, Array<(data: any) => void>> = {};

    // 订阅事件
    on(event: string, callback: (data: any) => void): void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    // 取消订阅
    off(event: string, callback?: (data: any) => void): void {
        if (!this.events[event]) return;

        if (callback) {
            this.events[event] = this.events[event].filter(
                (cb) => cb !== callback
            );
        } else {
            delete this.events[event];
        }
    }

    // 触发事件
    emit(event: string, data: any): void {
        if (this.events[event]) {
            this.events[event].forEach((callback) => callback(data));
        }
    }

    // 一次性事件订阅
    once(event: string, callback: (data: any) => void): void {
        const wrapper = (data: any) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}
