import { ReactElement } from 'react';
import { IconProps, IconWeight } from './types';
import * as React from "react";
interface IconBaseProps extends IconProps {
    weights: Map<IconWeight, ReactElement>;
}
declare const IconBase: React.ForwardRefExoticComponent<Omit<IconBaseProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
export default IconBase;
