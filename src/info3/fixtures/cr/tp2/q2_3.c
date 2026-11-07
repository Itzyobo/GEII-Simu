#include "mcc_generated_files/mcc.h"


void ENCB_ISR(void);

void main(void) {

    SYSTEM_Initialize();

    IOCAF2_SetInterruptHandler(ENCB_ISR);

    INTERRUPT_GlobalInterruptEnable();

    while (1)
    {
        LED_D2_PORT = ENCB_GetValue();
    }
}

void ENCB_ISR(void)
{
    LED_D3_PORT = (ENCB_GetValue()==ENCA_GetValue());
}