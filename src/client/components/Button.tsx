import * as React from 'react';
import classNames from 'classnames';

import { filterKeypress } from '../accessibility-utils';

type ButtonProps = {
    children: React.ReactNode;
    title?: string;
    className?: string;
    onClick?: () => void;
}

const Button: React.FunctionComponent<ButtonProps> = (props: ButtonProps) => (
    <div
        className={classNames('button', props.className)}
        title={props.title}
        onClick={props.onClick}
        onKeyDown={(e): void => filterKeypress(e, props.onClick)}
        role="button"
        tabIndex={0}
    >
        {props.children}
    </div>
);

export default Button;
