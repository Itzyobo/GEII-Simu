#include "mcc_generated_files/mcc.h"

void ENCB_ISR(void);

volatile uint8_t cpt = 0;

void main(void)
{
    SYSTEM_Initialize();

    IOCAF2_SetInterruptHandler(ENCB_ISR);

    INTERRUPT_GlobalInterruptEnable();

    while (1)
    {
    }
}

/* Un front de ENCB par cran : ENCA = ENCB en sens horaire (ENCA en avance), différents en sens antihoraire */
void ENCB_ISR(void)
{
    if (ENCB_GetValue() == ENCA_GetValue())
    {
        cpt = (cpt + 1) & 0x0F;
    }
    else
    {
        cpt = (cpt - 1) & 0x0F;
    }
    PORTA = (PORTA & 0x0F) | (cpt << 4);
}
