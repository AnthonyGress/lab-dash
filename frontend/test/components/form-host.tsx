// Hosts a form piece the way AddEditForm does: a react-hook-form instance handed to
// react-hook-form-mui's FormContainer, so TextFieldElement, CheckboxElement and
// Controller find their form. The render prop receives the form so a config can be
// given its `formContext`, and `form()` hands the same instance back to the test.
import { ReactNode } from 'react';
import { DefaultValues, useForm, UseFormReturn } from 'react-hook-form';
import { FormContainer } from 'react-hook-form-mui';

import { Rendered, renderWithProviders } from './render';
import { FormValues } from '../../src/components/forms/AddEditForm/types';
import { IAppContext } from '../../src/context/AppContext';

type Children = (formContext: UseFormReturn<FormValues>) => ReactNode;

type Options = {
    defaultValues?: DefaultValues<FormValues>;
    onSubmit?: (data: FormValues) => void;
    context?: Partial<IAppContext>;
};

export type RenderedForm = Rendered & { form: () => UseFormReturn<FormValues> };

export const renderInForm = (children: Children, { defaultValues, onSubmit, context }: Options = {}): RenderedForm => {
    let captured: UseFormReturn<FormValues> | undefined;

    // Built per render, like the harness's own Wrapper, so the file exports no component
    const FormHost = () => {
        const formContext = useForm<FormValues>({ defaultValues: { itemType: 'widget', ...defaultValues } });
        captured = formContext;

        return (
            <FormContainer formContext={formContext} onSuccess={onSubmit ?? (() => undefined)}>
                {children(formContext)}
            </FormContainer>
        );
    };

    const rendered = renderWithProviders(<FormHost />, { context });

    return { ...rendered, form: () => captured! };
};
