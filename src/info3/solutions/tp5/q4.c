#include "mcc_generated_files/mcc.h"

typedef struct {
     uint8_t red;
     uint8_t green;
     uint8_t blue;
} rgb_color_t;

typedef enum
{
  SET_RED,
  SET_GREEN,
  SET_BLUE
} state_t;

void RGBL_SetColor(rgb_color_t color);
void IncrementCurrentColor(void);
void DecrementCurrentColor(void);
void AfficheEtat(void);
void led_ring_display16(uint16_t led_state);
void BP_S1_ISR(void);
void BP_S2_ISR(void);
void ENCB_ISR(void);

volatile rgb_color_t couleur = {0, 0, 0};
volatile state_t etat = SET_RED;
volatile uint8_t cpt = 0;   // position du codeur modulo 16 (anneau, TP4)

/*
 * TP5 question 4 : le codeur de la carte Rotary (mikroBUS 2) incremente (sens horaire) ou decremente
 * (sens anti-horaire) le champ courant par pas de 16 ; l'anneau suit la position du codeur (TP4 §5).
 * S2 change de champ, S1 incremente encore. Le champ est bloque entre 0 et 255.
 */
void main(void)
{
    uint8_t last = 0xFF;

    SYSTEM_Initialize();

    IOCBF4_SetInterruptHandler(BP_S1_ISR);
    IOCCF5_SetInterruptHandler(BP_S2_ISR);
    IOCAF2_SetInterruptHandler(ENCB_ISR);

    RST_SetHigh();
    SPI1_Open(SPI1_DEFAULT);

    RGBL_SetColor(couleur);
    AfficheEtat();

    INTERRUPT_GlobalInterruptEnable();

    while (1)
    {
        if (cpt != last)
        {
            last = cpt;
            led_ring_display16((uint16_t)1 << last);
        }
    }
}

void RGBL_SetColor(rgb_color_t color)
{
    PWM6_LoadDutyValue((uint16_t)color.red << 2);
    PWM7_LoadDutyValue((uint16_t)color.green << 2);
    PWM1_LoadDutyValue((uint16_t)color.blue << 2);
}

uint8_t Plus16(uint8_t x)
{
    if (x > 255 - 16)
    {
        return 255;
    }
    return x + 16;
}

uint8_t Moins16(uint8_t x)
{
    if (x < 16)
    {
        return 0;
    }
    return x - 16;
}

void IncrementCurrentColor(void)
{
    switch (etat)
    {
        case SET_RED:
            couleur.red = Plus16(couleur.red);
            break;
        case SET_GREEN:
            couleur.green = Plus16(couleur.green);
            break;
        case SET_BLUE:
            couleur.blue = Plus16(couleur.blue);
            break;
    }
    RGBL_SetColor(couleur);
}

void DecrementCurrentColor(void)
{
    switch (etat)
    {
        case SET_RED:
            couleur.red = Moins16(couleur.red);
            break;
        case SET_GREEN:
            couleur.green = Moins16(couleur.green);
            break;
        case SET_BLUE:
            couleur.blue = Moins16(couleur.blue);
            break;
    }
    RGBL_SetColor(couleur);
}

void AfficheEtat(void)
{
    LED_D5_SetLow();
    LED_D4_SetLow();
    LED_D3_SetLow();
    if (etat == SET_RED)
    {
        LED_D5_SetHigh();
    }
    else if (etat == SET_GREEN)
    {
        LED_D4_SetHigh();
    }
    else
    {
        LED_D3_SetHigh();
    }
}

void BP_S1_ISR(void)
{
    IncrementCurrentColor();
}

void BP_S2_ISR(void)
{
    if (etat == SET_RED)
    {
        etat = SET_GREEN;
    }
    else if (etat == SET_GREEN)
    {
        etat = SET_BLUE;
    }
    else
    {
        etat = SET_RED;
    }
    AfficheEtat();
}

/* Un front de ENCB par cran : ENCA = ENCB en sens horaire (TP2) */
void ENCB_ISR(void)
{
    if (ENCB_GetValue() == ENCA_GetValue())
    {
        cpt = (cpt + 1) & 0x0F;
        IncrementCurrentColor();
    }
    else
    {
        cpt = (cpt - 1) & 0x0F;
        DecrementCurrentColor();
    }
}

void led_ring_display16(uint16_t led_state)
{
    SPI1_ExchangeByte(led_state >> 8);
    SPI1_ExchangeByte(led_state & 0xFF);
    LATCH_SetHigh();
    LATCH_SetLow();
}
