import * as React from 'react';

import Button from './Button';
import { Thread } from '../../common/communication';
import { DebugServer } from '../server-comm';
import NextIcon from '../img/debugger-next.svg';
import StepInIcon from '../img/debugger-step-in.svg';

type DebugControlsProps = {
    thread: Thread;
    debugServer: DebugServer;
}

const DebugControls: React.FunctionComponent<DebugControlsProps> = (props: DebugControlsProps) => (
    <div className="debug-controls">
        {props.thread.status === 'stopped' && (
            <>
                <Button
                    title="Continue execution"
                    onClick={(): void => props.debugServer.proceed(props.thread)}
                >
                    <i className="fas fa-play" />
                </Button>
                <Button
                    title="Next line"
                    onClick={(): void => props.debugServer.next(props.thread)}
                >
                    <NextIcon />
                </Button>
                <Button
                    title="Step into function"
                    onClick={(): void => props.debugServer.stepIn(props.thread)}
                >
                    <StepInIcon />
                </Button>
            </>
        )}
        {props.thread.status === 'running' && <div className="small-loading-spinner" />}
    </div>
);

export default DebugControls;
