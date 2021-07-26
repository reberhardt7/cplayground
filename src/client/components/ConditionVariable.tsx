import * as React from 'react';

import { ConditionVariable as ConditionVariableInfo } from '../../common/communication';

type ConditionVariableProps = {
    cv: ConditionVariableInfo;
};

const ConditionVariable: React.FunctionComponent<ConditionVariableProps> = (
    props: ConditionVariableProps,
) => (
    <div className="mutex">
        <div className="mutex-header">
            {props.cv.address}
        </div>
        <p>
            Waiters: {props.cv.waiters.length > 0
                ? (
                    <ul>
                        {props.cv.waiters.map((threadNum) => (
                            <li key={threadNum}>Thread {threadNum}</li>
                        ))}
                    </ul>
                )
                : '(none)'}
        </p>
    </div>
);

export default ConditionVariable;
