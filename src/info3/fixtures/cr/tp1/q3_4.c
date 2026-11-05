#include "mcc_generated_files/mcc.h"
void main(void)
{
    SYSTEM_Initialize();
    while (1)
    {
        if (BP_S1_GetValue() == 0)
            LED_D2_SetHigh();
        else
            LED_D2_SetLow();
    }
}
