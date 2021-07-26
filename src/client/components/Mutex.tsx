import * as React from 'react';

import { Mutex as MutexInfo } from '../../common/communication';
import { ThreadPill } from './ThreadsListing';

type MutexProps = {
    mutex: MutexInfo;
    pid: number;
    processColor: string;
    tidColorMap?: {[tid: number]: string};
};

const Mutex: React.FunctionComponent<MutexProps> = (props: MutexProps) => (
    <div className="mutex">
        <div className="mutex-header">
            {props.mutex.address}
        </div>
        <p>Owner: {props.mutex.owner !== null
            ? (
                <ThreadPill
                    pid={props.pid}
                    processColor={props.processColor}
                    tid={props.mutex.owner}
                    threadColor={props.tidColorMap[props.mutex.owner]}
                />
            ) : '(none)'}
        </p>
        <p>
            Waiters: {props.mutex.waiters.length > 0
                ? (
                    <ul>
                        {props.mutex.waiters.map((threadNum) => (
                            <li key={threadNum}>
                                <ThreadPill
                                    pid={props.pid}
                                    processColor={props.processColor}
                                    tid={threadNum}
                                    threadColor={props.tidColorMap[threadNum]}
                                />
                            </li>
                        ))}
                    </ul>
                )
                : '(none)'}
        </p>
    </div>
);

export default Mutex;
