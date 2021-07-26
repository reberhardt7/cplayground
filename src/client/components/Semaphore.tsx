import * as React from 'react';

import { Semaphore as SemaphoreInfo } from '../../common/communication';

type SemaphoreProps = {
    semaphore: SemaphoreInfo;
};

const Semaphore: React.FunctionComponent<SemaphoreProps> = (props: SemaphoreProps) => (
    <div className="mutex">
        <div className="mutex-header">
            {props.semaphore.address}
        </div>
        <p>Count: {props.semaphore.count}</p>
        <p>
            Waiters: {props.semaphore.waiters.length > 0
                ? (
                    <ul>
                        {props.semaphore.waiters.map((threadNum) => (
                            <li key={threadNum}>Thread {threadNum}</li>
                        ))}
                    </ul>
                )
                : '(none)'}
        </p>
    </div>
);

export default Semaphore;
